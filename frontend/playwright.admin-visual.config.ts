import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:['admin-visual.spec.ts','catalog-lightbox.spec.ts'],workers:1,reporter:'list',use:{...base.use,video:'off',launchOptions:process.env.BOBUY_BROWSER_PATH?{executablePath:process.env.BOBUY_BROWSER_PATH}:{}}});
