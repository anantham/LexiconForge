# IMG2IMG Testing Guide

## Overview
The img2img functionality has been successfully implemented using PiAPI's Flux models. This allows users to generate images guided by existing "steering" images.

## Implementation Status: ✅ COMPLETE
- All components implemented and integrated
- Build successful with no errors
- Claude adapter restored and working
- Development server running on http://localhost:5174/

## Features Added

### 1. Steering Image Dropdown
- Available steering images: `hypno.jpg`, `train.jpg`, `waitinginline.jpg`, `white.jpg`
- Located in `/data/Illustrations/steering/`
- Dropdown appears in all Illustration components
- Selection persists per illustration marker per chapter

### 2. API Integration
- **Text-to-Image**: When "None (Text-to-Image)" is selected
- **Image-to-Image**: When a steering image is selected
- Uses PiAPI Flux models: `Qubico/flux1-dev`, `Qubico/flux1-schnell`, `Qubico/flux1-dev-advanced`

### 3. UI Integration
- Dropdown appears in error state (when image generation fails)
- Dropdown appears when no image exists yet
- Dropdown appears when regenerating existing images

## Testing Steps

### Prerequisites
1. **PiAPI API Key**: Add your PiAPI API key in Settings
2. **Image Model**: Set image model to a Qubico/flux model in Settings
3. **Steering Images**: Ensure the 4 steering images exist in `/data/Illustrations/steering/`

### Testing Process
1. **Navigate to a chapter with translation**
2. **Find an illustration placeholder** (`[ILLUSTRATION-1]` etc.)
3. **Select a steering image** from the dropdown (e.g., "hypno")
4. **Click "Generate Image"** or "Retry Generation"
5. **Verify**: Image should be generated using img2img mode
6. **Compare**: Try the same prompt with "None" selected to see text2img difference

### Expected Behavior
- **With steering image**: More controlled output based on composition/style of steering image
- **Without steering image**: Standard text2img generation
- **Error handling**: Clear error messages if steering image fails to load

## API Details
- **Text2img**: `{"model": "Qubico/flux1-dev", "task_type": "txt2img", "input": {"prompt": "...", "width": 1024, "height": 1024}}`
- **Img2img**: `{"model": "Qubico/flux1-dev", "task_type": "img2img", "input": {"prompt": "...", "width": 1024, "height": 1024, "image": "data:image/jpeg;base64,..."}}`

## Development Server
The feature is ready for testing on `http://localhost:5174/`

## Known Limitations
1. **Browser Context**: Steering image previews are not available in browser (shows filename instead)
2. **Server-side Loading**: Actual image loading happens server-side for the API call
3. **File Access**: Direct file system access is limited to server-side operations