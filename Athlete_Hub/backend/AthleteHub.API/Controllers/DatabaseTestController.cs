using AthleteHub.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DatabaseTestController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public DatabaseTestController(AthleteHubDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> TestDatabase()
    {
        try
        {
            await _context.Database.OpenConnectionAsync();
            await _context.Database.CloseConnectionAsync();

            return Ok(new
            {
                connected = true,
                database = "athlete_hub",
                message = "Successfully connected to MySQL."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                connected = false,
                message = ex.Message,
                innerError = ex.InnerException?.Message
            });
        }
    }
}