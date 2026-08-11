using AthleteHub.API.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<AthleteHubDbContext>(options =>
    options.UseMySQL(connectionString!));

builder.Services.AddControllers();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Temporarily disabled while testing HTTP locally
// app.UseHttpsRedirection();

app.MapControllers();

app.Run();