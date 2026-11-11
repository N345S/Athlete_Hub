// Export a table as an Excel workbook (.xlsx) or a PDF. Both run in the browser, so nothing is sent anywhere.
// `columns` is [{ header, value: (row) => string | number, width? }].

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const escapeXml = (value) => String(value ?? '')
  // Characters XML 1.0 does not allow would make Excel reject the file.
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function columnName(index) {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

let crcTable
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/** A ZIP archive with uncompressed ("stored") entries, which is all an .xlsx needs. */
function zip(files) {
  const encoder = new TextEncoder()
  const chunks = []
  const central = []
  let offset = 0
  for (const [name, text] of files) {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(text)
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034B50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // UTF-8 names
    local.setUint16(8, 0, true) // stored
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    chunks.push(new Uint8Array(local.buffer), nameBytes, data)

    const entry = new DataView(new ArrayBuffer(46))
    entry.setUint32(0, 0x02014B50, true)
    entry.setUint16(4, 20, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(8, 0x0800, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, data.length, true)
    entry.setUint32(24, data.length, true)
    entry.setUint16(28, nameBytes.length, true)
    entry.setUint32(42, offset, true)
    central.push(new Uint8Array(entry.buffer), nameBytes)
    offset += 30 + nameBytes.length + data.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054B50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Downloads the rows as an Excel workbook with a bold, frozen header row and a filter on every column. */
export function exportXlsx(filename, sheetName, columns, rows) {
  const cell = (value, ref, header) => {
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${header ? ' s="1"' : ''}><v>${value}</v></c>`
    return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
  }
  const lastColumn = columnName(columns.length - 1)
  const sheetRows = [
    `<row r="1">${columns.map((column, index) => cell(column.header, `${columnName(index)}1`, true)).join('')}</row>`,
    ...rows.map((row, rowIndex) => `<row r="${rowIndex + 2}">${columns.map((column, index) => cell(column.value(row) ?? '', `${columnName(index)}${rowIndex + 2}`, false)).join('')}</row>`),
  ]
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width || 18}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A1:${lastColumn}${rows.length + 1}"/></worksheet>`
  // Excel rejects a name with \ / ? * [ ] :, a leading or trailing apostrophe, or more than 31 characters.
  const safeSheetName = escapeXml(String(sheetName).replace(/[\\/?*[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Sheet1')
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${safeSheetName.replace(/'/g, "''")}'!$A$1:$${lastColumn}$${rows.length + 1}</definedName></definedNames></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF8B071E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml', sheet],
  ]
  download(zip(files), filename)
}

/** Downloads the rows as a landscape A4 PDF with a title, the date it was made, and page numbers. */
export async function exportPdf(filename, title, subtitle, columns, rows) {
  // Loaded only when someone exports, so the PDF library does not slow down the first page load.
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(139, 7, 30)
  doc.text('Athlete-Hub', 40, 40)
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(13)
  doc.text(title, 40, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(subtitle, 40, 76, { maxWidth: width - 80 })
  autoTable(doc, {
    startY: 90,
    head: [columns.map((column) => column.header)],
    body: rows.map((row) => columns.map((column) => String(column.value(row) ?? ''))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [139, 7, 30], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 245, 245] },
    margin: { left: 40, right: 40, bottom: 40 },
    didDrawPage: () => {
      const height = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`Page ${doc.getNumberOfPages()}`, width - 40, height - 20, { align: 'right' })
    },
  })
  doc.save(filename)
}
