using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "ADMIN")]
public class AdminController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public AdminController(AthleteHubDbContext context)
    {
        _context = context;
    }

    // ==========================================
    // GET ALL USERS
    // GET: /api/Admin/users
    // ==========================================

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .Select(u => new
            {
                u.UserId,
                u.UniversityId,
                u.Email,
                u.FirstName,
                u.MiddleName,
                u.LastName,
                u.Phone,
                u.AccountStatus,
                u.CreatedAt,
                u.UpdatedAt,
                Role = u.Role.RoleName
            })
            .ToListAsync();

        return Ok(new
        {
            endpoint = "GET /api/Admin/users",
            count = users.Count,
            users
        });
    }

    [HttpGet("users/{userId}")]
    public async Task<IActionResult> GetUser(int userId)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        return user == null
            ? NotFound(new { message = "User not found." })
            : Ok(ToResponse(user));
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(CreateAdminUserRequest request)
    {
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleId == request.RoleId);

        if (role == null)
        {
            return BadRequest(new { message = "The specified role does not exist." });
        }

        if (await _context.Users.AnyAsync(u => u.Email == request.Email || u.UniversityId == request.UniversityId))
        {
            return Conflict(new { message = "Email or university ID is already registered." });
        }

        var user = new User
        {
            RoleId = role.RoleId,
            UniversityId = request.UniversityId.Trim(),
            Email = request.Email.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FirstName = request.FirstName.Trim(),
            MiddleName = request.MiddleName,
            LastName = request.LastName.Trim(),
            Phone = request.Phone,
            AccountStatus = "ACTIVE",
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        if (role.RoleName == "ATHLETE")
        {
            _context.AthleteProfiles.Add(new AthleteProfile
            {
                UserId = user.UserId,
                StudentNumber = user.UniversityId
            });

            await _context.SaveChangesAsync();
        }

        await _context.Entry(user).Reference(u => u.Role).LoadAsync();
        return CreatedAtAction(nameof(GetUser), new { userId = user.UserId }, ToResponse(user));
    }

    [HttpPut("users/{userId}")]
    public async Task<IActionResult> UpdateUser(int userId, UpdateAdminUserRequest request)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        var targetRole = user.Role;

        if (request.RoleId.HasValue)
        {
            targetRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleId == request.RoleId.Value);

            if (targetRole == null)
            {
                return BadRequest(new { message = "The specified role does not exist." });
            }

            user.RoleId = targetRole.RoleId;
        }

        if (request.Email != null && await _context.Users.AnyAsync(u => u.UserId != userId && u.Email == request.Email))
        {
            return Conflict(new { message = "Email is already registered." });
        }

        if (request.UniversityId != null && await _context.Users.AnyAsync(u => u.UserId != userId && u.UniversityId == request.UniversityId))
        {
            return Conflict(new { message = "University ID is already registered." });
        }

        user.UniversityId = request.UniversityId?.Trim() ?? user.UniversityId;
        user.Email = request.Email?.Trim() ?? user.Email;
        user.FirstName = request.FirstName?.Trim() ?? user.FirstName;
        user.MiddleName = request.MiddleName ?? user.MiddleName;
        user.LastName = request.LastName?.Trim() ?? user.LastName;
        user.Phone = request.Phone ?? user.Phone;
        user.AccountStatus = request.AccountStatus?.ToUpperInvariant() ?? user.AccountStatus;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        }

        var hasAthleteProfile = await _context.AthleteProfiles
            .AnyAsync(profile => profile.UserId == user.UserId);

        if (targetRole.RoleName == "ATHLETE" && !hasAthleteProfile)
        {
            _context.AthleteProfiles.Add(new AthleteProfile
            {
                UserId = user.UserId,
                StudentNumber = user.UniversityId
            });
        }

        await _context.SaveChangesAsync();
        await _context.Entry(user).Reference(currentUser => currentUser.Role).LoadAsync();
        return Ok(ToResponse(user));
    }

    [HttpDelete("users/{userId}")]
    public async Task<IActionResult> DeleteUser(int userId)
    {
        if (int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var currentUserId)
            && currentUserId == userId)
        {
            return BadRequest(new { message = "You cannot delete the account you are currently using." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        _context.Users.Remove(user);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new
            {
                message = "User cannot be deleted because related records exist. Set the account status to INACTIVE instead."
            });
        }

        return NoContent();
    }

    private static object ToResponse(User user)
    {
        return new
        {
            user.UserId,
            user.UniversityId,
            user.Email,
            user.FirstName,
            user.MiddleName,
            user.LastName,
            user.Phone,
            user.AccountStatus,
            user.CreatedAt,
            user.UpdatedAt,
            Role = user.Role.RoleName
        };
    }
}