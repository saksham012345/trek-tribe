// Patches to normalize some third-party typings for build-time in the Docker image.

// socket.io-client: provide loose types to avoid value/type conflicts across versions
declare module 'socket.io-client' {
  const io: any;
  export { io };
  export type Socket = any;
  export default io;
}

// axios: relax response.data typing so code that assumes shapes won't fail TS strict checks
import 'axios';
declare module 'axios' {
  export interface AxiosResponse<T = any> {
    data: any;
  }
}
