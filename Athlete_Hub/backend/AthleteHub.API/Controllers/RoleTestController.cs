using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoleTestController : ControllerBase
{
    // ==========================================
    // ATHLETE ONLY
    // GET: /api/RoleTest/athlete
    // ==========================================

    [Authorize(Roles = "ATHLETE")]
    [HttpGet("athlete")]
    public IActionResult AthleteOnly()
    {
        return Ok(new
        {
            endpoint = "GET /api/RoleTest/athlete",
            access = "GRANTED",
            roleRequired = "ATHLETE",
            message = "You have successfully accessed the ATHLETE-only endpoint."
        });
    }


    // ==========================================
    // COACH ONLY
    // GET: /api/RoleTest/coach
    // ==========================================

    [Authorize(Roles = "COACH")]
    [HttpGet("coach")]
    public IActionResult CoachOnly()
    {
        return Ok(new
        {
            endpoint = "GET /api/RoleTest/coach",
            access = "GRANTED",
            roleRequired = "COACH",
            message = "You have successfully accessed the COACH-only endpoint."
        });
    }


    // ==========================================
    // DIRECTOR ONLY
    // GET: /api/RoleTest/director
    // ==========================================

    [Authorize(Roles = "DIRECTOR")]
    [HttpGet("director")]
    public IActionResult DirectorOnly()
    {
        return Ok(new
        {
            endpoint = "GET /api/RoleTest/director",
            access = "GRANTED",
            roleRequired = "DIRECTOR",
            message = "You have successfully accessed the DIRECTOR-only endpoint."
        });
    }


    // ==========================================
    // ADMIN ONLY
    // GET: /api/RoleTest/admin-test
    // ==========================================

    [Authorize(Roles = "ADMIN")]
    [HttpGet("admin-test")]
    public IActionResult AdminTest()
    {
        return Ok(new
        {
            endpoint = "GET /api/RoleTest/admin-test",
            access = "GRANTED",
            roleRequired = "ADMIN",
            message = "You have successfully accessed the ADMIN-only endpoint."
        });
    }


    // ==========================================
    // REGISTRAR ONLY
    // GET: /api/RoleTest/registrar
    // ==========================================

    [Authorize(Roles = "REGISTRAR")]
    [HttpGet("registrar")]
    public IActionResult RegistrarOnly()
    {
        return Ok(new
        {
            endpoint = "GET /api/RoleTest/registrar",
            access = "GRANTED",
            roleRequired = "REGISTRAR",
            message = "You have successfully accessed the REGISTRAR-only endpoint."
        });
    }
}