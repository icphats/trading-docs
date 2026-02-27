import {defineConfig} from '@junobuild/config';

export default defineConfig({
  satellite: {
    ids: {
      production: '7vdgm-saaaa-aaaal-asxqq-cai'
    },
    source: 'build',
    predeploy: ['npm run build']
  }
});
