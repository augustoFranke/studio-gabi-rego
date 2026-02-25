# Local Font Assets

This directory contains production web font binaries used by `next/font/local`.

## Current families

- `sans/geist-latin.woff2`
- `sans/geist-latin-ext.woff2`
- `mono/geist-mono-latin.woff2`
- `mono/geist-mono-latin-ext.woff2`

## Usage

- Loader module: `src/lib/typography/fonts.ts`
- Runtime wiring: `src/app/layout.tsx`
- Design token mapping: `src/app/globals.css` (`--font-sans`, `--font-mono`)

## Update policy

- Keep web fonts self-hosted (no external runtime font fetch dependency).
- When replacing binaries, update this file with source and version details.
