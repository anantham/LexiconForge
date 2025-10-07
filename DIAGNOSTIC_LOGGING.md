# Diagnostic Logging for Illustrations & Footnotes Issue

## Issue Description
Footnotes and illustrations are not appearing in the UI despite being present in the translation data.

## Diagnostic Logging Added

I've added comprehensive console logging throughout the illustration and footnote rendering pipeline to track exactly what's happening with the data.

### 1. ChapterView Component

**Location**: `components/ChapterView.tsx`

#### a. Main Chapter Data Logging (lines 333-348)
Logs when chapter data updates, showing:
- Chapter ID and title
- Translation data presence
- **Footnotes count and full data**
- **suggestedIllustrations count and full data**
- Current view mode

**What to check**: When you select a chapter, look for this log to verify the data is present in memory.

#### b. Tokenization Logging (lines 122-140)
Logs during text tokenization, showing:
- Total tokens parsed
- **Footnote token count and markers** (e.g., `[1]`, `[2]`)
- **Illustration token count and markers** (e.g., `[ILLUSTRATION-1]`)
- Text sample being tokenized

**What to check**: Confirms that the translation text contains the `[1]` and `[ILLUSTRATION-X]` markers and that they're being parsed correctly.

#### c. Footnotes Rendering (lines 863-870)
Logs when `renderFootnotes()` is called, showing:
- Whether footnotes array exists
- Footnote count
- Full footnotes data

**What to check**: If this returns 0 footnotes when you expect some, the data isn't reaching the render function.

### 2. Illustration Component

**Location**: `components/Illustration.tsx`

#### Illustration Mount/Update Logging (lines 57-69)
Logs every time an Illustration component mounts or updates, showing:
- The marker it's looking for (e.g., `ILLUSTRATION-1`)
- Chapter ID
- Total suggestedIllustrations count
- **All available markers in the chapter**
- Whether the specific marker was found
- Full illustration data if found

**What to check**:
- If `foundIllust: false`, the marker in the text doesn't match any marker in `suggestedIllustrations` array
- Check if `allMarkers` array matches the markers in the translated text

### 3. Image Slice (Store)

**Location**: `store/slices/imageSlice.ts`

#### loadExistingImages Logging (lines 221-254)
Logs when loading existing illustration images from memory/storage:
- Chapter data structure
- suggestedIllustrations array details
- **Images loaded from cache** (keys and details)
- Current generatedImages state

**What to check**: This shows if illustrations have `generatedImage` or `url` properties with actual image data.

## How to Use This Diagnostic Information

### Step 1: Open Developer Console
Open your browser's developer console (F12 or Cmd+Option+I)

### Step 2: Navigate to a Translated Chapter
1. Select a chapter that you know has a translation
2. Switch to "English" view mode

### Step 3: Collect the Logs

Look for these specific log groups in order:

```
[ChapterView] Chapter Data Update
```
- **Check**: `footnotes: X` (should be > 0)
- **Check**: `suggestedIllustrations: Y` (should be > 0)
- **Check**: `footnotesData` array has objects with `marker` and `text`
- **Check**: `illustrationsData` array has objects with `placementMarker` and `imagePrompt`

```
[ChapterView:tokenizeTranslation]
```
- **Check**: `footnoteCount: X` matches the number of `[1]`, `[2]`, etc. in the text
- **Check**: `illustrationCount: Y` matches the number of `[ILLUSTRATION-1]`, etc. in the text
- **Check**: `footnoteMarkers` array shows the parsed markers
- **Check**: `illustrationMarkers` array shows the parsed markers

```
[ChapterView:renderFootnotes]
```
- **Check**: `footnoteCount: X` (should be > 0 if footnotes exist)
- **Check**: `footnotes` array has data

```
[Illustration] Component mounted/updated for marker: ILLUSTRATION-X
```
- **Check**: `foundIllust: true` (if false, marker mismatch!)
- **Check**: `allMarkers` array contains the marker being searched for
- **Check**: `illustData` has the full illustration object

```
[ImageSlice:loadExistingImages]
```
- **Check**: `suggestedIllustrationsCount: Y`
- **Check**: `suggestedIllustrationsData` shows the array
- **Check**: `loadedImageCount: Z` shows if images were loaded into state
- **Check**: `imageDetails` shows if illustrations have `url` or `generatedImage` properties

## Common Issues to Look For

### Issue 1: Markers Don't Match
**Symptom**: `illustrationMarkers` in tokenization doesn't match `allMarkers` in Illustration component
**Cause**: The text has `[ILLUSTRATION-1]` but `suggestedIllustrations` array has `placementMarker: "ILLUSTRATION-2"`
**Fix**: The AI response had a mismatch - re-translate or manually fix

### Issue 2: No Footnotes in Data
**Symptom**: `footnotes: 0` in Chapter Data Update log
**Cause**: The translation result doesn't have footnotes despite having `[1]` markers in text
**Fix**: The AI didn't populate the `footnotes` array correctly

### Issue 3: No suggestedIllustrations in Data
**Symptom**: `suggestedIllustrations: 0` in Chapter Data Update log
**Cause**: The translation result doesn't have the array populated
**Fix**: The AI didn't generate illustration suggestions

### Issue 4: Illustrations Present But No Images
**Symptom**: `foundIllust: true` but no image shows
**Cause**: The illustration object doesn't have `url` or `generatedImage` properties
**Check**: Look at `illustData` in the Illustration component log - does it have image data?

### Issue 5: Images Not Loaded into State
**Symptom**: `loadedImageCount: 0` in ImageSlice log despite illustrations existing
**Cause**: The `loadExistingImages` function isn't finding image data in the chapter
**Check**: Look at `suggestedIllustrationsData` - do the objects have `url` or `generatedImage` fields?

## Next Steps

1. **Run the app** with the diagnostic logging
2. **Copy the console output** for a chapter that should have footnotes/illustrations
3. **Share the logs** so we can see exactly where the data is lost in the pipeline
4. Based on the logs, I can then fix the specific issue

## Removing Diagnostic Logging

Once we've identified and fixed the issue, remove the console.log statements by searching for:
- `console.log('[ChapterView`
- `console.log('[Illustration]`
- `console.log('[ImageSlice:loadExistingImages]`

Or we can keep them gated behind a debug flag if you want persistent diagnostics.
