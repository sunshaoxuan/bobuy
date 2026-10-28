import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'recommendation-history.spec.ts',workers:1,use:{...base.use,launchOptions:process.env.BOBUY_BROWSER_PATH?{executablePath:process.env.BOBUY_BROWSER_PATH}:{}}});
