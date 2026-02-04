# Legacy PHP Code

This directory contains the original PHP + MySQL implementation of HubGames.

**⚠️ This code is no longer used in production.**

The project has been migrated to Next.js 14 + Supabase. See the main README for details.

## Contents

- `ajax/` - PHP AJAX endpoints
- `php/` - Core PHP files (database connection, session management)
- `vistas/` - PHP view files
- `includes/` - Shared PHP components (nav, footer)
- `sql/` - Database schema (MySQL)
- `cronjob/` - Scheduled tasks
- `datos_judi/` - File-based JUDI progress storage
- `vendor/` - Composer dependencies
- `composer.json` - PHP dependencies
- `index.php` - Original entry point

## Migration Notes

All functionality has been migrated to the new Next.js application:
- Database: MySQL → Supabase (PostgreSQL)
- Authentication: PHP sessions → Supabase Auth
- JUDI tracking: File-based → Supabase + localStorage
- Views: PHP → React components (TSX)

This code is kept for reference purposes only.
