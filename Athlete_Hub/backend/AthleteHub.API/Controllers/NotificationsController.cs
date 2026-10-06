using System.Security.Claims;
using AthleteHub.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AthleteHub.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public NotificationsController(AthleteHubDbContext context) => _context = context;

    [HttpGet("me")]
    public async Task<IActionResult> GetMyNotifications()
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();

        var notifications = await _context.Notifications
            .Where(notification => notification.UserId == userId)
            .OrderByDescending(notification => notification.CreatedAt)
            .Take(50)
            .Select(notification => new
            {
                notification.NotificationId,
                notification.Title,
                notification.Message,
                notification.NotificationType,
                notification.IsRead,
                notification.CreatedAt
            })
            .ToListAsync();

        return Ok(notifications);
    }

    [HttpPut("{notificationId:int}/read")]
    public async Task<IActionResult> MarkAsRead(int notificationId)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var notification = await _context.Notifications.FirstOrDefaultAsync(item => item.NotificationId == notificationId && item.UserId == userId);
        if (notification == null) return NotFound(new { message = "Notification not found." });

        notification.IsRead = true;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("me/unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        var count = await _context.Notifications.CountAsync(item => item.UserId == userId && item.IsRead != true);
        return Ok(new { count });
    }

    [HttpPut("me/read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        await _context.Notifications
            .Where(item => item.UserId == userId && item.IsRead != true)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.IsRead, true));
        return NoContent();
    }

    private bool TryGetUserId(out int userId) => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
}