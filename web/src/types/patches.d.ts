// Patches to normalize some third-party typings for build-time in the Docker image.

// axios: relax response.data typing so code that assumes shapes won't fail TS strict checks
import 'axios';
declare module 'axios' {
  export interface AxiosResponse<_T = any> {
    data: any;
  }
}

// socket.io-client: provide loose types to avoid value/type conflicts across versions
declare module 'socket.io-client' {
  const io: any;
  export { io };
  export type Socket = any;
  export default io;
}
// process: provide a global declaration in case @types/node is not found
declare var process: {
  env: {
    [key: string]: string | undefined;
  };
};

declare module 'react';
declare module 'react-dom';
declare module 'react-router-dom';
declare module 'lucide-react';
