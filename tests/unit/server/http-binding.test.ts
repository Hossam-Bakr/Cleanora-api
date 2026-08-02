import type { Server } from "node:http";

import {
  HTTP_BIND_HOST,
  listenForHttp,
} from "../../../src/server.js";

describe("HTTP container binding", () => {
  it("binds the environment port on every network interface", () => {
    const server = {} as Server;
    const listen = vi.fn(
      (
        _port: number,
        _hostname: string,
        callback: () => void,
      ): Server => {
        callback();
        return server;
      },
    );
    const onListening = vi.fn();

    expect(listenForHttp({ listen }, 8_765, onListening)).toBe(server);
    expect(listen).toHaveBeenCalledWith(
      8_765,
      "0.0.0.0",
      expect.any(Function),
    );
    expect(HTTP_BIND_HOST).toBe("0.0.0.0");
    expect(onListening).toHaveBeenCalledOnce();
  });
});
