import { exposeElectronTRPC } from 'electron-trpc/main';

process.once('loaded', async () => {
  exposeElectronTRPC();
});
