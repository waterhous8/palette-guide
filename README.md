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
   - Framework Preset: `Other`
   - Build Command: leave blank
   - Output Directory: `public`
   - Install Command: leave blank
5. Deploy.

This is a static browser app. It does not need Node.js, server functions, or environment variables.
