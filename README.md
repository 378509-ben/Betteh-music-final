# Betteh Music — Full Project (Modern energetic theme)

This project is a Node.js + Express site with an admin panel for managing:
- Posts (Entertainment Industry)
- Gallery (uploads)
- Staff (photos, titles, bios)
- Social links

Theme: modern energetic (electric blue + dark gray).

## Quick local run
1. Copy `.env.example` to `.env` and update values (ADMIN_USER, ADMIN_PASS, SESSION_SECRET).
2. Install and run:
   ```bash
   npm install
   npm start
   ```
3. Visit http://localhost:3000 and go to `/login`.

Deploy on Render:
- Push to GitHub and connect to Render. Set environment variables in Render for ADMIN_USER, ADMIN_PASS, SESSION_SECRET. Use build command `npm install` and start command `npm start`.
