# image-crop-craft

This project is a utility that runs locally, is provided with a local folder, loads that up and shows a gallery of the images in it. Each image has a rectangle showing how it will be cropped and scaled to 800x480. The rectangle can be moved on each of the images to adjust where the cropping will take place, but it can't be resized and will always be the same width as the image. Each image, when loaded, will be sent to the backend, which will provide the y coordinate for the top of the rectangle. There's a button that says "convert" that sends all of the images and the y coordinate of their rectangle, as selected by the user.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
