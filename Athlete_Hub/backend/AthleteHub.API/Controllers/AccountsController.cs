using System.Security.Claims;
using AthleteHub.API.Data;
using AthleteHub.API.DTOs;
using AthleteHub.API.Models;
using AthleteHub.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

/// <summary>
/// Account management. The Sports Director creates accounts and controls who can sign in; the Admin role is
/// hidden (see <see cref="HiddenRoles"/>) and is only listed here so its portal keeps working if it comes back.
/// Accounts with a hidden role are left out everywhere, as if they did not exist. The director needs the unlocked
/// token from re-entering their password (see <see cref="SensitiveAccess"/>).
/// </summary>
[ApiController]
[Route("api/Accounts")]
[Authorize(Roles = "DIRECTOR,ADMIN", Policy = SensitiveAccess.Policy)]
public class AccountsController : ControllerBase
{
    private static readonly string[] ValidStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"];
    private readonly AthleteHubDbContext _context;

    public AccountsController(AthleteHubDbContext context)
    {
        _context = context;
    }

    private IQueryable<User> VisibleUsers => _context.Users.Where(u => !HiddenRoles.Unlisted.Contains(u.Role.RoleName));

    // ==========================================
    // GET ALL USERS
    // GET: /api/Accounts/users
    // ==========================================

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await VisibleUsers
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
                Role = u.Role.RoleName,
                // Parents have no university ID; they are identified through their children's.
                linkedAthletes = u.Children.Select(link => new
                {
                    athleteUserId = link.Athlete.UserId,
                    link.Athlete.User.FirstName,
                    link.Athlete.User.LastName,
                    link.Athlete.User.UniversityId
                }).ToList()
            })
            .ToListAsync();

        return Ok(new
        {
            endpoint = "GET /api/Accounts/users",
            count = users.Count,
            users
        });
    }

    [HttpGet("users/{userId}")]
    public async Task<IActionResult> GetUser(int userId)
    {
        var user = await VisibleUsers
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        return user == null
            ? NotFound(new { message = "We could not find this account. It may have been deleted." })
            : Ok(ToResponse(user));
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(CreateAdminUserRequest request)
    {
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleId == request.RoleId);

        if (role == null || HiddenRoles.IsUnlisted(role.RoleName))
        {
            return BadRequest(new { message = "Please choose a role from the list." });
        }

        var isParent = role.RoleName == "PARENT";
        request.Email = request.Email.Trim().ToLowerInvariant();
        request.UniversityId = isParent ? null : request.UniversityId?.Trim();
        if (!isParent && string.IsNullOrEmpty(request.UniversityId))
        {
            return BadRequest(new { message = "Please enter the University ID." });
        }

        if (await _context.Users.AnyAsync(u => u.Email == request.Email || (request.UniversityId != null && u.UniversityId == request.UniversityId)))
        {
            return Conflict(new { message = "Someone already uses this email or University ID." });
        }

        // A parent is correlated to their children through the children's university IDs.
        var childAthleteIds = new List<int>();
        if (isParent)
        {
            var (athleteIds, problem) = await ResolveChildUniversityIdsAsync(request.ChildUniversityIds);
            if (problem != null) return problem;
            childAthleteIds = athleteIds;
        }

        var user = new User
        {
            RoleId = role.RoleId,
            UniversityId = request.UniversityId,
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

        if (isParent)
        {
            var relationship = string.IsNullOrWhiteSpace(request.Relationship) ? null : request.Relationship.Trim();
            _context.ParentAthletes.AddRange(childAthleteIds.Select(athleteId => new ParentAthlete
            {
                ParentUserId = user.UserId,
                AthleteId = athleteId,
                Relationship = relationship,
                CreatedAt = DateTime.UtcNow
            }));

            await _context.SaveChangesAsync();
        }
        else if (role.RoleName == "ATHLETE")
        {
            _context.AthleteProfiles.Add(new AthleteProfile
            {
                UserId = user.UserId,
                StudentNumber = user.UniversityId!
            });

            await _context.SaveChangesAsync();
        }
        else if (role.RoleName == "COACH")
        {
            _context.CoachProfiles.Add(new CoachProfile
            {
                UserId = user.UserId
            });

            await _context.SaveChangesAsync();
        }

        await _context.Entry(user).Reference(u => u.Role).LoadAsync();
        return CreatedAtAction(nameof(GetUser), new { userId = user.UserId }, ToResponse(user));
    }

    [HttpPut("users/{userId}")]
    public async Task<IActionResult> UpdateUser(int userId, UpdateAdminUserRequest request)
    {
        var user = await VisibleUsers
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new { message = "We could not find this account. It may have been deleted." });
        }

        var targetRole = user.Role;
        var newStatus = request.AccountStatus?.Trim().ToUpperInvariant() ?? user.AccountStatus;
        if (!ValidStatuses.Contains(newStatus))
        {
            return BadRequest(new { message = "Please choose Active, Inactive, or Suspended." });
        }

        if (request.RoleId.HasValue)
        {
            targetRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleId == request.RoleId.Value);

            if (targetRole == null || HiddenRoles.IsUnlisted(targetRole.RoleName))
            {
                return BadRequest(new { message = "Please choose a role from the list." });
            }
        }

        var guard = await GuardSelfLockoutAsync(user, targetRole.RoleName, newStatus);
        if (guard != null) return guard;
        user.RoleId = targetRole.RoleId;

        request.Email = request.Email?.Trim().ToLowerInvariant();
        if (request.Email != null && await _context.Users.AnyAsync(u => u.UserId != userId && u.Email == request.Email))
        {
            return Conflict(new { message = "Someone already uses this email." });
        }

        request.UniversityId = string.IsNullOrWhiteSpace(request.UniversityId) ? null : request.UniversityId.Trim();
        if (request.UniversityId != null && await _context.Users.AnyAsync(u => u.UserId != userId && u.UniversityId == request.UniversityId))
        {
            return Conflict(new { message = "Someone already uses this University ID." });
        }

        // Parents have no university ID; everyone else must keep one.
        user.UniversityId = targetRole.RoleName == "PARENT" ? null : request.UniversityId ?? user.UniversityId;
        if (user.UniversityId == null && targetRole.RoleName != "PARENT")
        {
            return BadRequest(new { message = "Please enter the University ID. This kind of account needs one." });
        }

        user.Email = request.Email?.Trim() ?? user.Email;
        user.FirstName = request.FirstName?.Trim() ?? user.FirstName;
        user.MiddleName = request.MiddleName ?? user.MiddleName;
        user.LastName = request.LastName?.Trim() ?? user.LastName;
        user.Phone = request.Phone ?? user.Phone;
        user.AccountStatus = newStatus;

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
                StudentNumber = user.UniversityId!
            });
        }

        var hasCoachProfile = await _context.CoachProfiles
            .AnyAsync(profile => profile.UserId == user.UserId);

        if (targetRole.RoleName == "COACH" && !hasCoachProfile)
        {
            _context.CoachProfiles.Add(new CoachProfile
            {
                UserId = user.UserId
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
            return BadRequest(new { message = "You cannot delete your own account." });
        }

        var user = await VisibleUsers.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null)
        {
            return NotFound(new { message = "We could not find this account. It may have been deleted." });
        }

        var guard = await GuardSelfLockoutAsync(user, "NONE", "DELETED");
        if (guard != null) return guard;

        _context.Users.Remove(user);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new
            {
                message = "This account cannot be deleted because it already has records. Set it to Inactive instead."
            });
        }

        return NoContent();
    }

    /// <summary>
    /// Quickly activates, deactivates, or suspends an account. The change applies to the user's
    /// next request because tokens of non-active accounts are rejected.
    /// </summary>
    [HttpPut("users/{userId}/status")]
    public async Task<IActionResult> UpdateStatus(int userId, [FromBody] AccountStatusRequest request)
    {
        var status = request.Status?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!ValidStatuses.Contains(status))
        {
            return BadRequest(new { message = "Please choose Active, Inactive, or Suspended." });
        }

        var user = await VisibleUsers.Include(u => u.Role).FirstOrDefaultAsync(u => u.UserId == userId);
        if (user == null)
        {
            return NotFound(new { message = "We could not find this account. It may have been deleted." });
        }

        var guard = await GuardSelfLockoutAsync(user, user.Role.RoleName, status);
        if (guard != null) return guard;

        user.AccountStatus = status;
        await _context.SaveChangesAsync();
        return Ok(ToResponse(user));
    }

    /// <summary>
    /// The athletes a parent account is linked to. Parents only ever see these children's training.
    /// </summary>
    [HttpGet("users/{userId}/children")]
    public async Task<IActionResult> GetChildren(int userId)
    {
        if (!await _context.Users.AnyAsync(u => u.UserId == userId && u.Role.RoleName == "PARENT"))
        {
            return NotFound(new { message = "We could not find this parent's account." });
        }

        return Ok(await _context.ParentAthletes
            .Where(link => link.ParentUserId == userId)
            .Select(link => new
            {
                athleteUserId = link.Athlete.UserId,
                link.Athlete.User.FirstName,
                link.Athlete.User.LastName,
                link.Athlete.User.UniversityId,
                link.Relationship
            })
            .ToListAsync());
    }

    /// <summary>
    /// Replaces the set of athletes linked to a parent account (by the athletes' user IDs).
    /// </summary>
    [HttpPut("users/{userId}/children")]
    public async Task<IActionResult> SetChildren(int userId, SetParentChildrenRequest request)
    {
        if (!await _context.Users.AnyAsync(u => u.UserId == userId && u.Role.RoleName == "PARENT"))
        {
            return NotFound(new { message = "We could not find this parent's account." });
        }

        var requestedUserIds = request.AthleteUserIds.Distinct().ToList();
        var athletes = await _context.AthleteProfiles
            .Where(profile => requestedUserIds.Contains(profile.UserId))
            .Select(profile => new { profile.AthleteId, profile.UserId })
            .ToListAsync();
        if (athletes.Count != requestedUserIds.Count)
        {
            return BadRequest(new { message = "Each child must already have a student-athlete account." });
        }

        var relationship = string.IsNullOrWhiteSpace(request.Relationship) ? null : request.Relationship.Trim();
        var existing = await _context.ParentAthletes.Where(link => link.ParentUserId == userId).ToListAsync();
        var keepIds = athletes.Select(athlete => athlete.AthleteId).ToHashSet();
        _context.ParentAthletes.RemoveRange(existing.Where(link => !keepIds.Contains(link.AthleteId)));
        foreach (var link in existing.Where(link => keepIds.Contains(link.AthleteId)))
        {
            link.Relationship = relationship ?? link.Relationship;
        }
        _context.ParentAthletes.AddRange(keepIds
            .Except(existing.Select(link => link.AthleteId))
            .Select(athleteId => new ParentAthlete { ParentUserId = userId, AthleteId = athleteId, Relationship = relationship, CreatedAt = DateTime.UtcNow }));

        await _context.SaveChangesAsync();
        return await GetChildren(userId);
    }

    /// <summary>
    /// Maps children's university IDs to athlete profiles. A parent account needs at least one child.
    /// </summary>
    private async Task<(List<int> AthleteIds, IActionResult? Problem)> ResolveChildUniversityIdsAsync(IEnumerable<string>? universityIds)
    {
        var wanted = (universityIds ?? [])
            .Select(id => id.Trim())
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (wanted.Count == 0)
        {
            return ([], BadRequest(new { message = "Please enter the University ID of at least one child of this parent." }));
        }

        var found = await _context.AthleteProfiles
            .Where(profile => profile.User.UniversityId != null && wanted.Contains(profile.User.UniversityId))
            .Select(profile => new { profile.AthleteId, profile.User.UniversityId })
            .ToListAsync();
        var missing = wanted.Where(id => !found.Any(row => string.Equals(row.UniversityId, id, StringComparison.OrdinalIgnoreCase))).ToList();
        if (missing.Count > 0)
        {
            return ([], BadRequest(new { message = $"No student-athlete has the University ID {string.Join(", ", missing)}. Please check the number." }));
        }

        return (found.Select(row => row.AthleteId).Distinct().ToList(), null);
    }

    /// <summary>
    /// Stops the signed-in user from changing their own role or status, and keeps at least one active
    /// Sports Director, since directors are the ones who manage accounts.
    /// Returns an error result when the change is not allowed, otherwise null.
    /// </summary>
    private async Task<IActionResult?> GuardSelfLockoutAsync(User user, string newRole, string newStatus)
    {
        var currentUserId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
        var keepsRoleAndStatus = newRole == user.Role.RoleName && newStatus == "ACTIVE";

        if (user.UserId == currentUserId && !keepsRoleAndStatus)
        {
            return BadRequest(new { message = "You cannot change your own role or status. Ask another Sports Director to do it." });
        }

        var stillActiveDirector = newRole == "DIRECTOR" && newStatus == "ACTIVE";
        if (user.Role.RoleName == "DIRECTOR" && user.AccountStatus == "ACTIVE" && !stillActiveDirector)
        {
            var otherActiveDirectors = await _context.Users.CountAsync(u =>
                u.UserId != user.UserId && u.Role.RoleName == "DIRECTOR" && u.AccountStatus == "ACTIVE");
            if (otherActiveDirectors == 0)
            {
                return BadRequest(new { message = "There must always be at least one active Sports Director." });
            }
        }

        return null;
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

public sealed class AccountStatusRequest
{
    public string? Status { get; set; }
}

public sealed class SetParentChildrenRequest
{
    public List<int> AthleteUserIds { get; set; } = [];

    [System.ComponentModel.DataAnnotations.MaxLength(50)]
    public string? Relationship { get; set; }
}
