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
[Authorize(Roles = "ATHLETE")]
public class PortfolioController : ControllerBase
{
    private readonly AthleteHubDbContext _context;

    public PortfolioController(AthleteHubDbContext context)
    {
        _context = context;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyPortfolio()
    {
        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        var items = await _context.PortfolioItems
            .Where(item => item.AthleteId == athlete.AthleteId)
            .Include(item => item.Achievement)
            .OrderBy(item => item.DisplayOrder)
            .ThenByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                item.PortfolioItemId,
                item.AchievementId,
                item.Title,
                item.Description,
                item.DisplayOrder,
                item.IsVisible,
                item.CreatedAt,
                achievementStatus = item.Achievement == null
                    ? null
                    : item.Achievement.VerificationStatus
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> CreatePortfolioItem(PortfolioItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var athlete = await GetCurrentAthleteAsync();

        if (athlete == null)
        {
            return NotFound(new { message = "Athlete profile not found." });
        }

        if (!await AchievementBelongsToAthleteAsync(request.AchievementId, athlete.AthleteId))
        {
            return BadRequest(new { message = "The linked achievement does not belong to this athlete." });
        }

        var item = new PortfolioItem
        {
            AthleteId = athlete.AthleteId,
            AchievementId = request.AchievementId,
            Title = request.Title.Trim(),
            Description = request.Description,
            DisplayOrder = request.DisplayOrder ?? 0,
            IsVisible = request.IsVisible ?? true,
            CreatedAt = DateTime.UtcNow
        };

        _context.PortfolioItems.Add(item);
        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetMyPortfolio),
            null,
            ToResponse(item));
    }

    [HttpPut("{portfolioItemId}")]
    public async Task<IActionResult> UpdatePortfolioItem(
        int portfolioItemId,
        PortfolioItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var athlete = await GetCurrentAthleteAsync();
        var item = athlete == null
            ? null
            : await _context.PortfolioItems.FirstOrDefaultAsync(
                portfolioItem => portfolioItem.PortfolioItemId == portfolioItemId
                    && portfolioItem.AthleteId == athlete.AthleteId);

        if (item == null)
        {
            return NotFound(new { message = "Portfolio item not found." });
        }

        if (!await AchievementBelongsToAthleteAsync(request.AchievementId, item.AthleteId))
        {
            return BadRequest(new { message = "The linked achievement does not belong to this athlete." });
        }

        item.AchievementId = request.AchievementId;
        item.Title = request.Title.Trim();
        item.Description = request.Description;
        item.DisplayOrder = request.DisplayOrder ?? 0;
        item.IsVisible = request.IsVisible ?? true;

        await _context.SaveChangesAsync();

        return Ok(ToResponse(item));
    }

    [HttpDelete("{portfolioItemId}")]
    public async Task<IActionResult> DeletePortfolioItem(int portfolioItemId)
    {
        var athlete = await GetCurrentAthleteAsync();
        var item = athlete == null
            ? null
            : await _context.PortfolioItems.FirstOrDefaultAsync(
                portfolioItem => portfolioItem.PortfolioItemId == portfolioItemId
                    && portfolioItem.AthleteId == athlete.AthleteId);

        if (item == null)
        {
            return NotFound(new { message = "Portfolio item not found." });
        }

        _context.PortfolioItems.Remove(item);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task<AthleteProfile?> GetCurrentAthleteAsync()
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return null;
        }

        return await _context.AthleteProfiles.FirstOrDefaultAsync(a => a.UserId == userId);
    }

    private Task<bool> AchievementBelongsToAthleteAsync(int? achievementId, int athleteId)
    {
        return achievementId == null
            ? Task.FromResult(true)
            : _context.Achievements.AnyAsync(
                achievement => achievement.AchievementId == achievementId
                    && achievement.AthleteId == athleteId);
    }

    private static PortfolioItemResponse ToResponse(PortfolioItem item)
    {
        return new PortfolioItemResponse
        {
            PortfolioItemId = item.PortfolioItemId,
            AchievementId = item.AchievementId,
            Title = item.Title,
            Description = item.Description,
            DisplayOrder = item.DisplayOrder,
            IsVisible = item.IsVisible,
            CreatedAt = item.CreatedAt
        };
    }
}