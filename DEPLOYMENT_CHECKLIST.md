# Deployment Checklist

- [ ] All environment variables are set (DATABASE_URL, SENTRY_DSN, etc.)
- [ ] `prisma` and `@prisma/client` versions are in sync
- [ ] Database migrations are up to date (`npx prisma migrate deploy`)
- [ ] Health check endpoint (`/api/health`) returns 200 OK
- [ ] Sentry/LogRocket error logging is enabled
- [ ] CI/CD pipeline passes all tests
- [ ] Frontend and backend are both deployed and accessible 