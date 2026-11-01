# 0005. Private task files uploaded straight from the browser to Cloudinary

**Status:** accepted · **Date:** 2026-10-31 (Phase 6)

## Context

A task's creator and its admins attach pictures and documents for the assignee. Only the assignee, the creator and project admins may open them; everyone else sees how many there are. The API runs on Vercel, where request bodies are capped at 4.5 MB and functions are short-lived. Cloudinary was already in use for profile photos.

## Decision

1. The browser asks the API to **sign an upload** for one file. The server picks the storage name (`<folder>/tasks/<taskId>/<24 random hex>` plus the extension for documents) and signs it with `type: private` and the allowed formats.
2. The browser sends the file **straight to Cloudinary** with that signature, showing real upload progress.
3. The browser tells the API it is done. The server **looks the file up on Cloudinary** and checks the name prefix, the type and the size (10 MB), and the limit of 10 files per task, before saving a row. A file that fails is deleted from Cloudinary.
4. The task details include **signed download links that expire after ten minutes**, and only for the people who may open the files. Everyone else gets the count. The page asks for fresh links just before a download.

## Alternatives

- **Upload through the API.** One request and simpler code, but the 4.5 MB body cap and function time make it fragile, and every byte would pass through a function that is billed by time.
- **Public files with hard-to-guess names.** Simple to show, but anyone who gets the link keeps access forever, including after they leave the project.
- **A download route that redirects to a signed link.** Hides the link, but it is one more route for the isolation matrix to classify, and the task details already know who may see what.
- **Another store (S3, Vercel Blob).** Fine choices; Cloudinary was already configured, signed, and gives image thumbnails for free.

## Consequences

- Files of any allowed size never touch the API, and uploads show progress.
- Losing a link is harmless after ten minutes.
- The server trusts nothing the browser says about the file: it re-reads it from storage.
- A file can be uploaded and never confirmed (the tab closes). It is private and unreachable, but it stays in storage until a cleanup job exists. Files of deleted tasks are removed when an account is purged.

## Revisit when

Uploads need virus scanning or larger files. A scanning step between upload and confirm, or a provider with built-in scanning, would slot in at step 3.
