# P5Background Carousel Implementation Plan

## Objective
Refactor the `P5Background` component to implement an optimal, stutter-free carousel transition sequence using the newly added `.webp` images located in `/media/wallpaper/webp_sm`.

## Current State Analysis
Currently, `P5Background.tsx` displays a static vector background unless overridden by a space configuration (`trading-space`, `code-lab`, etc.). The fallback is a single image: `thabang_vector_wallpaper_2.png`. The component re-renders elements directly on state change, which can cause unmounting/remounting stutters if an image is swapped in the `style={{ backgroundImage: ... }}` directly.

## Implementation Details

### 1. Define Carousel Assets
Create an array of the sequence of images:
```typescript
const CAROUSEL_IMAGES = [
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_1.webp',
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_2.webp',
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_3.webp',
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_4.webp',
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_5.webp',
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_6.webp',
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_7.webp',
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_8.webp',
  '/media/wallpaper/webp_sm/thabang_vector_wallpaper_9.webp',
];
```

### 2. Preload Images
To prevent stuttering and ensure smooth transitions, preload all images into the browser cache as soon as the component mounts.
```typescript
useEffect(() => {
  CAROUSEL_IMAGES.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}, []);
```

### 3. State & Interval Management
- **State**: Add a `currentIndex` state variable.
- **Effect**: Add a `setInterval` (e.g., every 10-15 seconds) to increment the `currentIndex` (modulo the length of `CAROUSEL_IMAGES`). Clean up the interval on unmount.
- **Conditional Handling**: Ensure the interval only runs if a specific space's static image override (`currentSpaceConfig.still`) is NOT active.

### 4. Cross-Fading Presentation Layer
To prevent losing image context and unmounting stutters, instead of swapping the `backgroundImage` URL on a single `div` (which causes a white flash before the browser paints the new image), we will render **all** carousel images as absolute layers. 
We will control their visibility purely using CSS opacity and transitions:
- Set `opacity: activeSpace?.slug === 'trading-space' ? 0.4 : 0.25` (from existing logic) if the image is the `currentIndex`.
- Set `opacity: 0` if it is not.
- Add `transition: opacity 2s ease-in-out` for a buttery smooth fade.

Alternatively, to save DOM nodes, we can render just the current image or override it, but rendering 9 divs with `opacity: 0` has negligible performance impact and guarantees 0 stutter because the DOM nodes never unmount during transitions.

## Task List
- [x] Read and confirm the directory structure for the new images.
- [ ] Add the `CAROUSEL_IMAGES` array and the `currentIndex` React state to `P5Background.tsx`.
- [ ] Add the image preloading `useEffect` hook.
- [ ] Add the auto-cycling interval `useEffect` hook.
- [ ] Update the `return` block to map over `CAROUSEL_IMAGES` and render them as stacked, cross-fading layers using CSS opacity.
- [ ] Ensure existing override logic (`currentSpaceConfig?.still`) correctly bypasses the carousel if applicable.

Please review this plan. If it looks good, we can proceed with modifying `P5Background.tsx`!
