# Favicon Upload Implementation Plan

## Overview
Replace the default Vite favicon (`vite.svg`) with a custom `apprentice.svg` and make favicon uploads configurable through the admin Site Settings panel.

## Current State Analysis

### Frontend
- **Favicon location**: Referenced in `Frontend/index.html` (line 5): `<link rel="icon" type="image/svg+xml" href="/vite.svg" />`
- **No `public/` directory**: Vite serves files from the root directory
- **Site Settings**: Already has logo upload functionality with image upload to `/api/v1/admin/blog/media/upload`
- **Build output**: Files go to `Frontend/dist/`

### Backend
- **Media upload**: `Backend/app/api/v1/endpoints/blog/media.py` handles image uploads
- **Upload directory**: `static/blog/uploads/` with date-based organization (`YYYY/MM/`)
- **SiteSettings model**: Already has `logo_url` and `logo_dark_url` fields
- **Validation**: Supports `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` (NOT `.svg` currently)
- **File serving**: Static files served from `/static/` route

### Current Logo Upload Flow
1. User uploads file in Site Settings → Branding tab
2. Frontend sends `FormData` to `/api/v1/admin/blog/media/upload`
3. Backend validates, optimizes, and saves to `static/blog/uploads/YYYY/MM/`
4. Returns URL like `/static/blog/uploads/2025/12/abc123.png`
5. Frontend updates `logo_url` or `logo_dark_url` in state and saves to DB

---

## Implementation Plan

### Phase 1: Create Default Favicon ✅ (Immediate)

**Goal**: Replace `vite.svg` with `apprentice.svg`

**Steps**:
1. Create a simple `apprentice.svg` favicon (wizard/apprentice themed)
2. Place it in `Frontend/` root directory (same level as `index.html`)
3. Update `Frontend/index.html` line 5:
   ```html
   <link rel="icon" type="image/svg+xml" href="/apprentice.svg" />
   ```
4. Test in dev mode (`npm run dev`) to verify favicon appears

**Files to modify**:
- `Frontend/index.html` (1 line change)
- `Frontend/apprentice.svg` (new file)

**No backend changes needed for Phase 1**

---

### Phase 2: Database Schema Updates 🔧 (Backend)

**Goal**: Add `favicon_url` field to `site_settings` table

**Steps**:

1. **Update SiteSettings model** (`Backend/app/api/v1/services/site_settings/models.py`):
   - Add field after `logo_dark_url` (line 74):
   ```python
   # Favicon
   favicon_url = Column(String(255), nullable=True)
   ```

2. **Update SiteSettings schemas** (`Backend/app/api/v1/services/site_settings/schemas.py`):
   - Add to `SiteSettingsBase` (after line 74):
   ```python
   # Favicon
   favicon_url: Optional[str] = Field(None, max_length=255)
   ```
   - Add to `SiteSettingsUpdate` (after line 158):
   ```python
   # Favicon
   favicon_url: Optional[str] = Field(None, max_length=255)
   ```

3. **Create Alembic migration**:
   ```bash
   cd Backend
   alembic revision -m "add_favicon_url_to_site_settings"
   ```
   - Edit the generated migration file:
   ```python
   def upgrade():
       op.add_column('site_settings', sa.Column('favicon_url', sa.String(255), nullable=True))

   def downgrade():
       op.drop_column('site_settings', 'favicon_url')
   ```

4. **Run migration**:
   ```bash
   alembic upgrade head
   ```

**Files to create/modify**:
- `Backend/app/api/v1/services/site_settings/models.py` (add 1 field)
- `Backend/app/api/v1/services/site_settings/schemas.py` (add 2 fields)
- `Backend/alembic/versions/XXXXX_add_favicon_url_to_site_settings.py` (new migration)

**No API endpoint changes needed** - existing GET/PUT `/api/v1/admin/site-settings` will automatically handle the new field

---

### Phase 3: Enhanced Media Upload Support 🖼️ (Optional - For SVG Support)

**Goal**: Allow SVG uploads for favicon (currently only raster images supported)

**Current limitation**: `ALLOWED_IMAGE_TYPES` in `media.py` only includes JPEG, PNG, GIF, WebP

**Decision point**:
- **Option A**: Keep using PNG/WebP for favicons (works everywhere, optimized by existing code)
- **Option B**: Add SVG support with additional validation (more modern, smaller file size)

**If choosing Option B** (recommended for favicons):

1. **Update `Backend/app/api/v1/endpoints/blog/media.py`**:
   - Line 24: Add `"image/svg+xml"` to `ALLOWED_IMAGE_TYPES`
   - Line 25: Add `".svg"` to `ALLOWED_EXTENSIONS`
   - Lines 59-80: Skip optimization for SVG files (can't use PIL)
   - Lines 133-142: Add separate validation for SVG (XML parsing for security)

2. **Add SVG security validation** (prevent XXE attacks):
   ```python
   import xml.etree.ElementTree as ET

   def validate_svg(file_content: bytes) -> bool:
       """Validate SVG is safe (no scripts, no external resources)"""
       try:
           tree = ET.fromstring(file_content)
           # Check for dangerous elements
           dangerous = ['script', 'iframe', 'object', 'embed']
           for elem in tree.iter():
               if elem.tag.split('}')[-1].lower() in dangerous:
                   return False
           return True
       except:
           return False
   ```

**Files to modify** (Option B):
- `Backend/app/api/v1/endpoints/blog/media.py` (add SVG support + validation)

---

### Phase 4: Frontend Site Settings UI 🎨 (Admin Panel)

**Goal**: Add favicon upload to Site Settings → Branding tab

**Steps**:

1. **Update TypeScript interface** (`Frontend/src/pages/admin/SiteSettings.tsx`):
   - Add to `SiteSettings` interface (after line 51):
   ```typescript
   favicon_url: string;
   ```
   - Add to `defaultSettings` (after line 114):
   ```typescript
   favicon_url: '',
   ```

2. **Add upload state** (after line 153):
   ```typescript
   const [uploadingFavicon, setUploadingFavicon] = useState(false);
   ```

3. **Add favicon upload handler** (after `handleLogoUpload` function, around line 288):
   ```typescript
   const handleFaviconUpload = async (file: File) => {
     if (!file) return;

     // Validate file type (SVG, PNG, ICO, WebP)
     const validTypes = ['image/svg+xml', 'image/png', 'image/x-icon', 'image/webp'];
     if (!validTypes.includes(file.type)) {
       setError('Please upload a valid favicon (SVG, PNG, ICO, or WebP)');
       return;
     }

     // Validate file size (1MB max for favicon)
     if (file.size > 1024 * 1024) {
       setError('Favicon must be less than 1MB');
       return;
     }

     try {
       setUploadingFavicon(true);
       setError(null);

       const formData = new FormData();
       formData.append('file', file);
       formData.append('alt_text', 'Site favicon');

       const response = await fetch('/api/v1/admin/blog/media/upload', {
         method: 'POST',
         credentials: 'include',
         body: formData,
       });

       if (!response.ok) {
         throw new Error('Upload failed');
       }

       const data = await response.json();
       setSettings({ ...settings, favicon_url: data.url });
       console.log(`✓ Favicon uploaded successfully: ${data.url}`);
     } catch (err) {
       console.error('Error uploading favicon:', err);
       setError('Failed to upload favicon. Please try again.');
     } finally {
       setUploadingFavicon(false);
     }
   };
   ```

4. **Add UI section to Branding tab** (after logo previews, around line 1071):
   ```tsx
   {/* Favicon Upload */}
   <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
     <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
       Favicon (Browser Tab Icon)
     </h3>
     <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
       Upload a custom favicon to replace the default. Recommended: 32x32px SVG or PNG.
     </p>

     <div className="flex gap-2">
       <input
         type="url"
         value={settings.favicon_url}
         onChange={(e) => handleChange('favicon_url', e.target.value)}
         placeholder="/apprentice.svg or https://yourdomain.com/favicon.svg"
         className="flex-1 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
       />
       <label className="relative">
         <input
           type="file"
           accept="image/svg+xml,image/png,image/x-icon,image/webp"
           className="hidden"
           onChange={(e) => {
             const file = e.target.files?.[0];
             if (file) handleFaviconUpload(file);
           }}
           disabled={uploadingFavicon}
         />
         <button
           type="button"
           onClick={(e) => {
             e.preventDefault();
             const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
             input?.click();
           }}
           disabled={uploadingFavicon}
           className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
         >
           {uploadingFavicon ? (
             <span className="flex items-center gap-2">
               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
               Uploading...
             </span>
           ) : (
             '📤 Upload'
           )}
         </button>
       </label>
     </div>
     <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
       Accepts: SVG (recommended), PNG, ICO, or WebP. Max size: 1MB.
     </p>

     {settings.favicon_url && (
       <div className="mt-4 bg-gray-50 dark:bg-slate-700 p-4 rounded-lg border border-gray-200 dark:border-slate-600">
         <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Preview</p>
         <div className="flex items-center gap-3">
           <img
             src={settings.favicon_url}
             alt="Favicon"
             className="w-8 h-8 border border-gray-300 dark:border-slate-500 rounded"
             onError={(e) => {
               e.currentTarget.style.display = 'none';
             }}
           />
           <code className="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 px-2 py-1 rounded">
             {settings.favicon_url}
           </code>
         </div>
       </div>
     )}
   </div>
   ```

**Files to modify**:
- `Frontend/src/pages/admin/SiteSettings.tsx` (add favicon upload section to Branding tab)

---

### Phase 5: Dynamic Favicon Loading 🔄 (Frontend)

**Goal**: Make favicon update dynamically based on site settings

**Challenge**: `index.html` is static, but we need dynamic favicon from database

**Solution**: Add favicon update logic to main app initialization

**Steps**:

1. **Create favicon update utility** (`Frontend/src/utils/favicon.ts`):
   ```typescript
   /**
    * Update the page favicon dynamically
    * @param faviconUrl - URL to the favicon (absolute or relative)
    */
   export function updateFavicon(faviconUrl: string | null) {
     if (!faviconUrl) {
       // Use default favicon
       faviconUrl = '/apprentice.svg';
     }

     // Remove existing favicon links
     const existingLinks = document.querySelectorAll("link[rel*='icon']");
     existingLinks.forEach(link => link.remove());

     // Detect file type
     const ext = faviconUrl.split('.').pop()?.toLowerCase();
     let type = 'image/x-icon'; // default
     if (ext === 'svg') type = 'image/svg+xml';
     else if (ext === 'png') type = 'image/png';
     else if (ext === 'webp') type = 'image/webp';

     // Create and add new favicon link
     const link = document.createElement('link');
     link.rel = 'icon';
     link.type = type;
     link.href = faviconUrl;
     document.head.appendChild(link);

     console.log(`✓ Favicon updated: ${faviconUrl}`);
   }
   ```

2. **Update App.tsx** to load favicon from settings:
   - Add import (top of file):
   ```typescript
   import { updateFavicon } from './utils/favicon';
   ```
   - Add effect to fetch and apply favicon (after existing useEffect hooks):
   ```typescript
   useEffect(() => {
     // Fetch site settings and update favicon
     const loadFavicon = async () => {
       try {
         const response = await fetch('/api/v1/site-settings');
         if (response.ok) {
           const settings = await response.json();
           if (settings.favicon_url) {
             updateFavicon(settings.favicon_url);
           }
         }
       } catch (error) {
         console.error('Failed to load favicon from settings:', error);
         // Keep default favicon on error
       }
     };

     loadFavicon();
   }, []);
   ```

3. **Update title as well** (bonus - while we're fetching settings):
   ```typescript
   useEffect(() => {
     const loadSiteMetadata = async () => {
       try {
         const response = await fetch('/api/v1/site-settings');
         if (response.ok) {
           const settings = await response.json();

           // Update favicon
           if (settings.favicon_url) {
             updateFavicon(settings.favicon_url);
           }

           // Update title
           if (settings.site_title) {
             document.title = settings.site_title;
           }
         }
       } catch (error) {
         console.error('Failed to load site metadata:', error);
       }
     };

     loadSiteMetadata();
   }, []);
   ```

**Files to create/modify**:
- `Frontend/src/utils/favicon.ts` (new file)
- `Frontend/src/App.tsx` (add favicon loading logic)

---

### Phase 6: Testing & Documentation 📝

**Testing checklist**:
- [ ] Default `apprentice.svg` displays correctly in dev mode
- [ ] Upload PNG favicon → appears in browser tab
- [ ] Upload SVG favicon → appears in browser tab
- [ ] Invalid file type → shows error message
- [ ] Large file (>1MB) → shows error message
- [ ] Save settings → favicon persists after page reload
- [ ] Clear favicon URL → reverts to default `apprentice.svg`
- [ ] Test in multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test dark mode doesn't affect favicon visibility

**Documentation to update**:
1. Add to `DEPLOY_TO_PRODUCTION.md`:
   - Note about favicon customization via admin panel
   - Mention default `apprentice.svg` can be replaced

2. Update admin documentation (if exists):
   - Screenshot of favicon upload in Branding tab
   - Recommended favicon specs (32x32px, SVG preferred)

---

## File Summary

### Files to Create (3)
1. `Frontend/apprentice.svg` - Default wizard/apprentice favicon
2. `Frontend/src/utils/favicon.ts` - Favicon update utility
3. `Backend/alembic/versions/XXXXX_add_favicon_url_to_site_settings.py` - Database migration

### Files to Modify (5)
1. `Frontend/index.html` - Change default favicon link
2. `Frontend/src/pages/admin/SiteSettings.tsx` - Add favicon upload UI
3. `Frontend/src/App.tsx` - Add dynamic favicon loading
4. `Backend/app/api/v1/services/site_settings/models.py` - Add `favicon_url` field
5. `Backend/app/api/v1/services/site_settings/schemas.py` - Add `favicon_url` to schemas
6. *(Optional)* `Backend/app/api/v1/endpoints/blog/media.py` - Add SVG support

---

## Implementation Order (Recommended)

### Sprint 1: Quick Win (30 minutes)
1. **Phase 1**: Create `apprentice.svg` and update `index.html` → Immediate visual change
2. Test in browser

### Sprint 2: Backend Foundation (1 hour)
1. **Phase 2**: Database schema updates
   - Modify models and schemas
   - Create and run migration
   - Test API returns new field
2. **Phase 3** *(optional)*: Add SVG upload support to media handler

### Sprint 3: Admin UI (1.5 hours)
1. **Phase 4**: Add favicon upload to Site Settings
   - Add UI section to Branding tab
   - Add upload handler
   - Test upload flow
2. Verify uploaded favicon URL is saved to database

### Sprint 4: Dynamic Loading (45 minutes)
1. **Phase 5**: Implement dynamic favicon loading
   - Create favicon utility
   - Update App.tsx
   - Test favicon changes on settings update
2. **Phase 6**: Testing and documentation

**Total estimated time**: ~4 hours for complete implementation

---

## Design Considerations

### Favicon File Types
| Format | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **SVG** | Scalable, small file size, modern | Not supported in IE11 | ✅ **Best choice** for modern sites |
| **PNG** | Universal support, good quality | Larger file size | ✅ Good fallback |
| **ICO** | Traditional favicon format | Outdated, multiple sizes needed | ⚠️ Avoid unless legacy support needed |
| **WebP** | Great compression | Limited browser support for favicons | ⚠️ Experimental |

**Recommendation**: Support SVG and PNG, default to SVG

### Security Considerations
1. **SVG XSS Prevention**:
   - Validate SVG XML structure
   - Strip `<script>` tags
   - Block external resources (`<use href="http://...">`)

2. **File Size Limits**:
   - Favicon: 1MB max (typically 1-50KB)
   - Prevent DoS via large uploads

3. **File Type Validation**:
   - Check both extension AND MIME type
   - Verify file content matches declared type

### UX Considerations
1. **Preview**: Show favicon preview in admin panel
2. **Reset**: Allow clearing custom favicon to revert to default
3. **Validation feedback**: Clear error messages for invalid files
4. **Loading states**: Show spinner during upload
5. **Default fallback**: Always have `apprentice.svg` as fallback

---

## Future Enhancements (Out of Scope)

1. **Multiple favicon sizes**: Generate 16x16, 32x32, 64x64 automatically
2. **Apple touch icons**: Support `apple-touch-icon` for iOS home screen
3. **Manifest icons**: PWA manifest with multiple icon sizes
4. **Favicon A/B testing**: Different favicons for different pages/themes
5. **Emoji favicons**: Allow selecting emoji as favicon (converts to SVG)
6. **Animated favicons**: Support animated SVG favicons (e.g., loading states)

---

## Rollback Plan

If issues occur:

1. **Phase 1 rollback**:
   ```bash
   git checkout HEAD -- Frontend/index.html Frontend/apprentice.svg
   ```

2. **Phase 2 rollback**:
   ```bash
   cd Backend
   alembic downgrade -1
   git checkout HEAD -- app/api/v1/services/site_settings/
   ```

3. **Phase 4-5 rollback**:
   ```bash
   git checkout HEAD -- Frontend/src/pages/admin/SiteSettings.tsx Frontend/src/App.tsx Frontend/src/utils/favicon.ts
   ```

---

## Questions to Clarify Before Starting

1. **Design for `apprentice.svg`**:
   - Do you have a specific wizard/apprentice design in mind?
   - Color scheme? (Matches site theme? Monochrome?)
   - Should it be simple/minimalist or detailed?

2. **SVG Support Priority**:
   - Do we implement SVG upload support immediately (Phase 3)?
   - Or start with PNG/WebP only and add SVG later?

3. **Scope**:
   - Just favicon, or also touch icons and PWA manifest?
   - Should favicon change based on dark/light theme?

4. **Testing**:
   - Do you want to test this on localhost first?
   - Or proceed straight to production deployment?

---

**Plan Status**: ✅ Ready for implementation
**Next Step**: Get clarifications on questions above, then start with Phase 1
