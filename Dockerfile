# Athlete-Hub hosted test deployment: one container serves the web app and the API on the same address.
# Deployment steps: Athlete_Hub/docs/DEPLOYMENT.md

# ---- Web app (React + Vite) ----
FROM node:22-slim AS web
WORKDIR /web
COPY Athlete_Hub/web/package.json Athlete_Hub/web/package-lock.json ./
RUN npm ci
COPY Athlete_Hub/web/ ./
# Optional build-time settings (see Athlete_Hub/web/README.md). Keep VITE_SHOW_TEST_ACCOUNTS off on a public address.
ARG VITE_SHOW_TEST_ACCOUNTS=false
ARG VITE_FEEDBACK_URL=
RUN npm run build

# ---- API (.NET) ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY Athlete_Hub/backend/AthleteHub.API/AthleteHub.API.csproj ./
RUN dotnet restore
COPY Athlete_Hub/backend/AthleteHub.API/ ./
RUN dotnet publish -c Release -o /app --no-restore

# ---- Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
COPY --from=web /web/dist ./client
# Uploaded documents are written to /app/private-uploads: mount a persistent volume there.
RUN mkdir -p /app/private-uploads
ENV ASPNETCORE_ENVIRONMENT=Production \
    App__BehindProxy=true
# Hosting platforms pass the port to listen on in $PORT.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet AthleteHub.API.dll"]
