import { Config } from '@remotion/cli/config'
import { enableTailwind } from '@remotion/tailwind-v4'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setPublicDir('./public')
Config.overrideBundlerConfig((c) => enableTailwind(c))
