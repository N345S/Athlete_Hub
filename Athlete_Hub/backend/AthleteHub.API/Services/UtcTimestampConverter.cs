using System.Text.Json;
using System.Text.Json.Serialization;

namespace AthleteHub.API.Services;

/// <summary>
/// The app stores every timestamp in UTC (<c>DateTime.UtcNow</c>), but the MySQL provider returns
/// <c>timestamp</c> columns as local-kind values. Serialized as-is they carry the server's offset
/// (e.g. "+08:00") on a UTC clock time, so a notification created a minute ago showed as "8 hours ago".
/// Local-kind values are written as UTC instead; dates without a kind (DATE columns) are left unchanged.
/// </summary>
public sealed class UtcTimestampConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.Kind == DateTimeKind.Local ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value);
}
