# Palette Guide

A static browser app for uploading a reference photo, applying a median-style simplification, sampling a color from the image, and suggesting pigment mixtures from a fixed painting palette.

## Local Use

Open `index.html` directly in a browser, or serve the folder with any static server.

## Deploy To Vercel

No environment variables are required.

1. Create a GitHub repository named `palette-guide`.
2. Push this folder to that repository.
3. In Vercel, import the GitHub repository.
4. Use these deployment settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Deploy.

This is a static browser app built with Vite. Browser code is served from `public/` as static assets; it does not need server functions or environment variables.
