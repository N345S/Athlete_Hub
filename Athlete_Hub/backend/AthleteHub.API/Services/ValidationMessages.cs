using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace AthleteHub.API.Services;

/// <summary>
/// Turns ASP.NET's validation errors ("The field Password must be a string or array type with a minimum length of
/// '8'.") into one plain sentence ("The password must have at least 8 characters."), sent as { message } like every
/// other error so the web app can show it as is.
/// </summary>
public static partial class ValidationMessages
{
    public const string General = "Some of the information is missing or not right. Please check the form and try again.";

    private const string WrongFormat = "Some of the information is in the wrong format. Please check the form and try again.";

    public static string Describe(ModelStateDictionary modelState)
    {
        foreach (var (key, entry) in modelState)
        {
            var error = entry.Errors.FirstOrDefault();
            if (error != null) return Describe(key, error);
        }
        return General;
    }

    private static string Describe(string key, ModelError error)
    {
        var text = error.ErrorMessage;
        // Unreadable JSON, or text where a number or date belongs.
        if (error.Exception != null || key.StartsWith('$') || text.Contains("JSON", StringComparison.Ordinal)) return WrongFormat;

        var field = FieldName(key);
        if (field == null) return General;
        var Field = char.ToUpperInvariant(field[0]) + field[1..];

        if (text.EndsWith("field is required.", StringComparison.Ordinal)) return $"Please fill in the {field}.";
        if (text.Contains("not a valid e-mail address", StringComparison.Ordinal)) return "Please enter a real email address, like name@example.com.";

        var minimum = MinimumLength().Match(text);
        if (minimum.Success) return $"The {field} must have at least {minimum.Groups[1].Value} characters.";
        var maximum = MaximumLength().Match(text);
        if (maximum.Success) return $"The {field} is too long ({maximum.Groups[1].Value} characters at most).";

        var range = Between().Match(text);
        if (range.Success)
        {
            // [Range(0, double.MaxValue)] only means "not negative".
            return range.Groups[2].Value.Contains('E')
                ? $"The {field} cannot be less than {range.Groups[1].Value}."
                : $"The {field} must be between {range.Groups[1].Value} and {range.Groups[2].Value}.";
        }

        // Messages written for a person (ErrorMessage = "...") are already plain.
        return text.StartsWith("The field ", StringComparison.Ordinal) || text.StartsWith("The value ", StringComparison.Ordinal)
            ? $"{Field} is not right. Please check it and try again."
            : text;
    }

    /// <summary>"request.UniversityId" → "university ID"; null for the whole request body.</summary>
    private static string? FieldName(string key)
    {
        var name = key.Split('.').Last().Trim('[', ']');
        if (name.Length == 0 || name.Equals("request", StringComparison.OrdinalIgnoreCase)) return null;
        var words = CamelCaseWord().Matches(name).Select(match => match.Value.Equals("Id", StringComparison.Ordinal) ? "ID" : match.Value.ToLowerInvariant());
        return string.Join(' ', words);
    }

    [GeneratedRegex(@"minimum length of '?(\d+)'?")]
    private static partial Regex MinimumLength();

    [GeneratedRegex(@"maximum length of '?(\d+)'?")]
    private static partial Regex MaximumLength();

    [GeneratedRegex(@"must be between (\S+) and (\S+?)\.?$")]
    private static partial Regex Between();

    [GeneratedRegex(@"[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])")]
    private static partial Regex CamelCaseWord();
}
