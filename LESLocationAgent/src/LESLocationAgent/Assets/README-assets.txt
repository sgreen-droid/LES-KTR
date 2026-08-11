LES Location Agent — Asset Placeholder

This directory requires an application icon:

  appicon.ico   (16x16, 32x32, 48x48, 256x256 recommended)

The GitHub Actions workflow generates a minimal placeholder icon automatically
so the build succeeds without a custom icon. For production, replace the
appicon.ico file with your organisation's branded icon before building.

To create a proper icon:
  1. Design or obtain a 256x256 PNG in your brand colour.
  2. Convert to ICO with multiple sizes using a tool such as:
       - https://www.icoconverter.com/
       - Paint.NET with ICO plugin
       - IcoFX
  3. Replace this placeholder with appicon.ico in the Assets folder.
  4. Push to GitHub and re-run the Windows Build workflow.
