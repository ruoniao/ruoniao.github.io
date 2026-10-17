# Design QA — personal site

final result: passed

## Scope and evidence

Reviewed the first functional implementation against the selected bright Home and holographic-map concepts. This is a real procedural 3D scene, not a recreation of the concept image as a background. Photographic atmosphere and exact mountain silhouettes are not reproduced; that visual distinction remains explicit in the handoff.

- Home source: `C:/Users/zhaogang/.codex/generated_images/01a14775-b0ed-7600-b591-963f00c968fe/exec-0cd74414-ffbe-4ebb-bf70-e79defd4df65.png` (973 × 1616).
- Map source: `C:/Users/zhaogang/.codex/generated_images/01a14775-b0ed-7600-b591-963f00c968fe/exec-97f07392-25ff-40fd-810b-d756535d8a77.png` (1586 × 992).
- Implementation: `../../outputs/home-desktop-top.png`, `../../outputs/knowledge-desktop.png`, `../../outputs/knowledge-mobile.png`.
- Browser CSS viewports: desktop 1440 × 1000; mobile 390 × 844. Desktop captures 1440 × 1000, normalized by width for comparison with differently sized generated concepts. Full-page Home stitching duplicated a strip, so the viewport capture is authoritative.
- Combined full-view comparisons: `../home-comparison.png`, `../map-final-comparison.png`.
- States: Home top; map overview with selected KV cache and details; mobile directory, filter and About. Focused inspection: Home introduction/sidebar, map selected-node panel and bottom controls. These are visible in the separate full-size screenshots; generated placeholder text is not treated as actual user biography.

## Findings and comparison history

1. Initial map distant peaks were cropped and terrain/labels too subdued. Adjusted camera framing, distance fog, terrain edge shader and label size; added secondary ridges for continuous terrain. Rechecked desktop overview.
2. Regular wireframe competed with knowledge paths. Reduced wire opacity and rendered parent paths as thin 3D tubes. Final selected-node screenshot distinguishes paths from terrain.
3. Jekyll excerpts starting with TOC were empty. Blog now derives fallback summaries from content. Category filtering tested: 11 total public posts, 1 miscellaneous post, 10 technical posts.
4. Full-screen map controls were checked at 390 × 844. Directory and detail panels scroll independently; document does not overflow horizontally or vertically. Phone uses a separate directory for accessible node navigation.

## Fidelity surfaces

- Typography: readable system sans serif Chinese text, restrained Home title and paragraphs, smaller secondary metadata. Real content is shorter than generated filler; no invented employment history.
- Spacing: introduction/sidebar, thin section rules and text-led project entries follow the selected structure. No Home mountain artwork or full-screen slide sections.
- Colors: near-white Home, charcoal body and muted-blue links; dark navy map with cyan geometry and status legend.
- Imagery: Home has no invented decorative assets. Map uses actual terrain meshes, edge shading, wireframe and surface paths, as requested. Its geometric appearance differs from the detailed cinematic mock; further art direction can refine terrain irregularity, haze and glow without changing data architecture.
- Copy: public alias/contact and existing article topics used; history and PDF explicitly pending. Knowledge levels are unassessed, not fabricated. Original post content and dates unchanged.

## Verified behavior

- Search matches KV cache/KVM; nonexistent query yields an empty state.
- Domain filter limits directory entries; selecting a node opens correct title, stage, ancestry and article link.
- Mouse dragging changes actual 3D orientation; zoom, reset and node focus work.
- Climb advances through ancestry and reveals distant peaks; stop/manual interaction exits.
- Hash restores selected node after reload.
- Blog filters update URL and visible counts; all public dates remain descending.
- About shows missing PDF honestly and exposes browser print action. Native print dialog/export was not exercised.
- Browser console inspected, no errors/warnings in tested states.
- Jekyll build and `scripts/validate_site.py` pass. New public links and knowledge links resolve; all 16 original article bodies and original metadata preserved except new `section` fields.

## Remaining limits / follow-up polish

- Real low-end phone GPU performance and physical pinch gestures need device testing; responsive desktop-browser checks are not a hardware benchmark.
- WebGL failure fallback is implemented; forced context-loss testing was not performed.
- No resume PDF or real career history supplied. Profile text is an editable draft derived from existing public topics.
- Terrain material is a live wireframe interpretation, not photographic fidelity to the concept. Further visual refinement can be discussed from the running preview.
