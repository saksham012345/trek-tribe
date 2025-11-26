import { check } from 'k6';
import ws from 'k6/ws';
import { sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '20s',
};

export default function () {
  const url = (__ENV.BACKEND_WS_URL || 'ws://localhost:4000') + '/socket.io/?EIO=3&transport=websocket';
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      socket.send('hello');
    });
    socket.on('message', function (msg) {
      // noop
    });
    socket.on('close', function () {
      // closed
    });
    socket.on('error', function (e) {
      // error
    });
    sleep(1);
  });
  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
