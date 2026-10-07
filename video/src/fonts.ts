import { loadFont as gorditas } from '@remotion/google-fonts/Gorditas'
import { loadFont as gluten } from '@remotion/google-fonts/Gluten'
import { loadFont as outfit } from '@remotion/google-fonts/Outfit'

// Same three faces as app/index.html. loadFont blocks the render until they are ready.
gorditas('normal', { weights: ['400', '700'], subsets: ['latin'] })
gluten('normal', { weights: ['700', '800'], subsets: ['latin'] })
outfit('normal', { weights: ['400', '600', '700', '800'], subsets: ['latin'] })
