# Screenshot kit

Retakes the README screenshots (`assets/screenshots/*.png`) with the same sample data every time. The UI is in English.

```sh
npm run screenshots          # build the app, then take photos / aspect / export / phones .png
npm run screenshot-samples   # only if you want to redraw the sample data
```

Needs Google Chrome (MP4 export uses Chrome's H.264 encoder) and the `playwright` dev dependency (`npm install`).

| File | What it is |
| --- | --- |
| `samples/*.jpg` | Eight illustrations (1500 × 1000) used as photos: sunset-beach, morning-mountains, city-night, autumn-forest, balloons, desert-dunes, flower-field, lake-moon |
| `samples/golden-hour.wav` | A 32-second synthesized tune used as the song |
| `make-samples.mjs` | Draws the illustrations and synthesizes the tune (the same output on every run) |
| `shoot.mjs` | Opens `dist/flipreel.html`, adds the samples, makes a video and takes the screenshots |

What each screenshot shows:

- `photos.png`: desktop, the Photos step with the eight samples
- `aspect.png`: desktop, the Aspect Ratio step
- `export.png`: desktop, the Export step after making a video with the song
- `phones.png`: phone, the Photos step (light) next to the finished video (dark)

The samples are drawn here, so they are free to use and contain no real photos or copyrighted music.
