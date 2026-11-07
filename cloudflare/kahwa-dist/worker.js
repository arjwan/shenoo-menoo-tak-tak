var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../.npm/_npx/d32e5042964412f9/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../../.npm/_npx/d32e5042964412f9/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../../.npm/_npx/d32e5042964412f9/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../.npm/_npx/d32e5042964412f9/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../../.npm/_npx/d32e5042964412f9/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var isWorkerdProcessV2 = globalThis.Cloudflare.compatibilityFlags.enable_nodejs_process_v2;
var unenvProcess = new Process({
  env: globalProcess.env,
  // `hrtime` is only available from workerd process v2
  hrtime: isWorkerdProcessV2 ? workerdProcess.hrtime : hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  // Always implemented by workerd
  env,
  // Only implemented in workerd v2
  hrtime: hrtime3,
  // Always implemented by workerd
  nextTick
} = unenvProcess;
var {
  _channel,
  _disconnect,
  _events,
  _eventsCount,
  _handleQueue,
  _maxListeners,
  _pendingMessage,
  _send,
  assert: assert2,
  disconnect,
  mainModule
} = unenvProcess;
var {
  // @ts-expect-error `_debugEnd` is missing typings
  _debugEnd,
  // @ts-expect-error `_debugProcess` is missing typings
  _debugProcess,
  // @ts-expect-error `_exiting` is missing typings
  _exiting,
  // @ts-expect-error `_fatalException` is missing typings
  _fatalException,
  // @ts-expect-error `_getActiveHandles` is missing typings
  _getActiveHandles,
  // @ts-expect-error `_getActiveRequests` is missing typings
  _getActiveRequests,
  // @ts-expect-error `_kill` is missing typings
  _kill,
  // @ts-expect-error `_linkedBinding` is missing typings
  _linkedBinding,
  // @ts-expect-error `_preload_modules` is missing typings
  _preload_modules,
  // @ts-expect-error `_rawDebug` is missing typings
  _rawDebug,
  // @ts-expect-error `_startProfilerIdleNotifier` is missing typings
  _startProfilerIdleNotifier,
  // @ts-expect-error `_stopProfilerIdleNotifier` is missing typings
  _stopProfilerIdleNotifier,
  // @ts-expect-error `_tickCallback` is missing typings
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  availableMemory,
  // @ts-expect-error `binding` is missing typings
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  // @ts-expect-error `domain` is missing typings
  domain,
  emit,
  emitWarning,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  // @ts-expect-error `initgroups` is missing typings
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  memoryUsage,
  // @ts-expect-error `moduleLoadList` is missing typings
  moduleLoadList,
  off,
  on,
  once,
  // @ts-expect-error `openStdin` is missing typings
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  // @ts-expect-error `reallyExit` is missing typings
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = isWorkerdProcessV2 ? workerdProcess : unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../.npm/_npx/d32e5042964412f9/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// cloudflare/game-engines/domino-engine.js
function buildDeck() {
  const deck = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) deck.push({ a, b, id: `${a}-${b}` });
  }
  return deck;
}
__name(buildDeck, "buildDeck");
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
__name(shuffle, "shuffle");
function totalPips(tiles) {
  return tiles.reduce((s, t) => s + t.a + t.b, 0);
}
__name(totalPips, "totalPips");
function createGame(params = {}) {
  const suppliedIds = Array.isArray(params.playerIds) ? params.playerIds.map(String).filter(Boolean) : [];
  const playersCount = Math.min(4, Math.max(2, suppliedIds.length || Number(params.players) || 2));
  const playerIds = suppliedIds.length ? suppliedIds.slice(0, playersCount) : Array.from({ length: playersCount }, (_, i) => "p" + i);
  let deck, hands, openingPlayer2 = params.preferredStarter && playerIds.includes(String(params.preferredStarter)) ? String(params.preferredStarter) : null;
  let openingDouble = null;
  do {
    deck = shuffle(buildDeck());
    hands = {};
    for (let i = 0; i < playersCount; i++) hands[playerIds[i]] = deck.splice(0, 7);
    if (!openingPlayer2) {
      for (let value = 6; value >= 0 && !openingPlayer2; value--) {
        for (const player of playerIds) if (hands[player].some((t) => t.a === value && t.b === value)) {
          openingPlayer2 = player;
          openingDouble = value;
          break;
        }
      }
    }
  } while (!openingPlayer2);
  const stock = deck;
  const chain = [];
  return {
    engine: "domino",
    version: 1,
    status: "waiting",
    turn: openingPlayer2,
    openingTileId: null,
    openingDouble,
    players: playerIds,
    maxPlayers: playersCount,
    hands,
    stock: stock.map((t) => ({ a: t.a, b: t.b, id: t.id })),
    chain: chain.map((t) => ({ a: t.a, b: t.b, id: t.id, left: true, right: true })),
    finished: false,
    winner: null,
    moveCount: 0,
    scores: params.scores && typeof params.scores === "object" ? { ...params.scores } : {},
    roundNumber: Math.max(1, Number(params.roundNumber) || 1),
    lastRound: params.lastRound || null,
    createdAt: /* @__PURE__ */ new Date()
  };
}
__name(createGame, "createGame");
function validateChain(chain) {
  const out = { valid: false, left: null, right: null };
  if (!Array.isArray(chain)) return out;
  for (let i = 0; i < chain.length; i++) {
    const t = chain[i];
    if (!t || !Number.isInteger(t.a) || !Number.isInteger(t.b)) return out;
    if (t.a < 0 || t.a > 6 || t.b < 0 || t.b > 6) return out;
    if (i + 1 < chain.length && t.b !== chain[i + 1].a) return out;
  }
  out.valid = true;
  if (chain.length) {
    out.left = chain[0].a;
    out.right = chain[chain.length - 1].b;
  }
  return out;
}
__name(validateChain, "validateChain");
function openEnds(chain) {
  const v = validateChain(chain);
  return v.left === null ? null : { left: v.left, right: v.right };
}
__name(openEnds, "openEnds");
function placementsFor(state, userId) {
  const hand = state.hands && state.hands[userId] || [];
  const chain = Array.isArray(state.chain) ? state.chain : [];
  const out = [];
  if (!chain.length) {
    for (const tile of hand) if (state.openingDouble == null || tile.a === state.openingDouble && tile.b === state.openingDouble) out.push({ type: "place", tile: { ...tile }, direction: "right" });
    return out;
  }
  const ends = validateChain(chain);
  if (!ends.valid) return out;
  for (const tile of hand) {
    if (tile.a === ends.left || tile.b === ends.left) out.push({ type: "place", tile: { ...tile }, direction: "left" });
    if (tile.a === ends.right || tile.b === ends.right) out.push({ type: "place", tile: { ...tile }, direction: "right" });
  }
  return out;
}
__name(placementsFor, "placementsFor");
function legalActions(state, userId) {
  if (state.status !== "active" && state.status !== "waiting") return [];
  if (state.turn !== userId) return [];
  const actions = placementsFor(state, userId);
  if (actions.length === 0 && state.stock && state.stock.length > 0) {
    actions.push({ type: "draw" });
  }
  if (actions.length === 0 && (!state.stock || state.stock.length === 0)) {
    actions.push({ type: "pass" });
  }
  return actions;
}
__name(legalActions, "legalActions");
function applyAction(state, userId, action = {}) {
  action = action && typeof action === "object" ? action : {};
  if (state.status !== "active" && state.status !== "waiting") return { error: "not active" };
  if (state.turn !== userId) return { error: "not your turn" };
  if (action.type === "draw") {
    if (!state.stock || state.stock.length === 0) return { error: "no stock" };
    if (!Array.isArray(state.hands[userId])) return { error: "not in game" };
    if (placementsFor(state, userId).length > 0) return { error: "\u0644\u062F\u064A\u0643 \u062D\u062C\u0631 \u0635\u0627\u0644\u062D \u0644\u0644\u0639\u0628 \u2014 \u0636\u0639\u0647 \u0628\u062F\u0644 \u0627\u0644\u0633\u062D\u0628" };
    const drawn = state.stock.splice(0, 1)[0];
    state.hands[userId].push(drawn);
    state.moveCount += 1;
    state.turn = userId;
    return { ok: true };
  }
  if (action.type === "pass") {
    if (state.stock && state.stock.length > 0) return { error: "cannot pass with stock" };
    if (placementsFor(state, userId).length > 0) return { error: "\u0644\u062F\u064A\u0643 \u062D\u062C\u0631 \u0635\u0627\u0644\u062D \u0644\u0644\u0639\u0628 \u2014 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u0645\u0631\u0648\u0631" };
    state.turn = state.players[(state.players.indexOf(userId) + 1) % state.players.length];
    state.moveCount += 1;
    if ((!state.stock || state.stock.length === 0) && state.players.every((p) => placementsFor(state, p).length === 0)) {
      const scores = {};
      for (const pl of state.players) scores[pl] = totalPips(state.hands[pl] || []);
      let lowest = state.players[0];
      for (const pl of state.players) if (scores[pl] < scores[lowest]) lowest = pl;
      const points2 = state.players.filter((pl) => pl !== lowest).reduce((sum, pl) => sum + totalPips(state.hands[pl] || []), 0);
      state.scores = state.scores || {};
      state.scores[lowest] = Number(state.scores[lowest] || 0) + points2;
      state.lastRound = { winner: lowest, points: points2, roundNumber: state.roundNumber || 1, blocked: true, remaining: state.players.filter((pl) => pl !== lowest).map((pl) => ({ player: pl, points: totalPips(state.hands[pl] || []) })) };
      state.status = "finished";
      state.winner = lowest;
      state.finished = true;
    }
    return { ok: true };
  }
  if (action.type === "place") {
    if (!Array.isArray(state.hands[userId])) return { error: "not in game" };
    const tile = state.hands[userId].find((t) => t.id === (action.tile && action.tile.id));
    if (!tile) return { error: "tile not in hand" };
    if (!state.chain.length) {
      if (state.openingDouble != null && (tile.a !== state.openingDouble || tile.b !== state.openingDouble)) return { error: "opening double required" };
      state.chain.push({ ...tile });
      state.openingDouble = null;
      state.openingTileId = tile.id;
    } else {
      if (action.direction !== "left" && action.direction !== "right") return { error: "illegal placement" };
      const ends = validateChain(state.chain);
      if (!ends.valid) return { error: "illegal placement" };
      let placed = null;
      if (action.direction === "left") {
        if (tile.b === ends.left) placed = { ...tile };
        else if (tile.a === ends.left) placed = { a: tile.b, b: tile.a, id: tile.id };
        else return { error: "illegal placement" };
        const candidate = [placed].concat(state.chain);
        if (!validateChain(candidate).valid) return { error: "illegal placement" };
        state.chain.unshift(placed);
      } else {
        if (tile.a === ends.right) placed = { ...tile };
        else if (tile.b === ends.right) placed = { a: tile.b, b: tile.a, id: tile.id };
        else return { error: "illegal placement" };
        const candidate = state.chain.concat([placed]);
        if (!validateChain(candidate).valid) return { error: "illegal placement" };
        state.chain.push(placed);
      }
    }
    state.hands[userId] = state.hands[userId].filter((t) => t.id !== tile.id);
    state.moveCount += 1;
    if (tile.a === tile.b) {
    }
    if (state.hands[userId].length === 0) {
      const points2 = state.players.filter((p) => p !== userId).reduce((sum, p) => sum + totalPips(state.hands[p] || []), 0);
      state.scores = state.scores || {};
      state.scores[userId] = Number(state.scores[userId] || 0) + points2;
      state.lastRound = { winner: userId, points: points2, roundNumber: state.roundNumber || 1, remaining: state.players.filter((p) => p !== userId).map((p) => ({ player: p, points: totalPips(state.hands[p] || []) })) };
      state.status = "finished";
      state.winner = userId;
      state.finished = true;
    } else {
      state.turn = state.players[(state.players.indexOf(userId) + 1) % state.players.length];
    }
    return { ok: true };
  }
  return { error: "unknown action" };
}
__name(applyAction, "applyAction");
function isFinished(state) {
  return state.finished || state.status === "finished";
}
__name(isFinished, "isFinished");
function getWinner(state) {
  return state.winner || null;
}
__name(getWinner, "getWinner");
function getPublicState(state) {
  return {
    status: state.status,
    turn: state.turn,
    players: state.players.map((id) => ({ id, handCount: (state.hands[id] || []).length })),
    chain: (state.chain || []).map((tile) => ({ a: tile.a, b: tile.b, id: tile.id })),
    chainLength: (state.chain || []).length,
    openingTileId: state.openingTileId || null,
    stockCount: (state.stock || []).length,
    moveCount: state.moveCount,
    finished: state.finished,
    winner: state.winner,
    scores: state.scores || {},
    roundNumber: state.roundNumber || 1,
    lastRound: state.lastRound || null
  };
}
__name(getPublicState, "getPublicState");
function getPrivateState(state, userId) {
  return {
    hand: state.hands[userId] || [],
    turn: state.turn === userId,
    status: state.status,
    chain: state.chain,
    stockCount: (state.stock || []).length
  };
}
__name(getPrivateState, "getPrivateState");
function serialize(state) {
  return JSON.stringify({ engine: "domino", version: 1, status: state.status, turn: state.turn, players: state.players, handCounts: state.players.map((id) => (state.hands[id] || []).length), chain: state.chain, stockLength: (state.stock || []).length, finished: state.finished, winner: state.winner, moveCount: state.moveCount, createdAt: state.createdAt });
}
__name(serialize, "serialize");
var engine = { createGame: /* @__PURE__ */ __name((params) => {
  const s = createGame(params);
  s.engine = "domino";
  return s;
}, "createGame"), getPublicState, getPrivateState, getLegalActions: legalActions, applyAction, isFinished, getWinner, serialize, validateChain, openEnds, placementsFor };
var domino_engine_default = engine;

// cloudflare/game-engines/tawla-engine.js
function emptyBoard() {
  return Array.from({ length: 24 }, () => ({ white: 0, black: 0 }));
}
__name(emptyBoard, "emptyBoard");
function setupBoard() {
  const b = emptyBoard(), setup = [[0, "black", 2], [11, "black", 5], [16, "black", 3], [18, "black", 5], [23, "white", 2], [12, "white", 5], [7, "white", 3], [5, "white", 5]];
  setup.forEach(([p, c, n]) => b[p][c] = n);
  return b;
}
__name(setupBoard, "setupBoard");
function plainMap(v) {
  if (!v) return {};
  if (v instanceof Map) return Object.fromEntries(v);
  if (typeof v === "object") return v;
  return {};
}
__name(plainMap, "plainMap");
function ensureColors(s) {
  const p0 = String(s.players && s.players[0] || ""), p1 = String(s.players && s.players[1] || "");
  let colors = plainMap(s.colors);
  if (p0 && p1) {
    const a = colors[p0], b = colors[p1];
    if (!["white", "black"].includes(a) || !["white", "black"].includes(b) || a === b) colors = { [p0]: "white", [p1]: "black" };
  }
  s.colors = colors;
  return colors;
}
__name(ensureColors, "ensureColors");
function repairState(s) {
  if (!s || typeof s !== "object") throw new Error("\u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0627\u0648\u0644\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629");
  s.players = Array.isArray(s.players) ? s.players.map(String) : [];
  s.bar = s.bar || { white: 0, black: 0 };
  s.home = s.home || { white: 0, black: 0 };
  const valid = Array.isArray(s.board) && s.board.length === 24;
  const total = valid ? s.board.reduce((n, p) => n + Number(p && p.white || 0) + Number(p && p.black || 0), 0) : 0;
  const alreadyPlayed = Number(s.moveCount || 0) > 0 || Number(s.home.white || 0) + Number(s.home.black || 0) > 0 || Number(s.bar.white || 0) + Number(s.bar.black || 0) > 0;
  if ((!valid || total === 0) && !alreadyPlayed) s.board = setupBoard();
  s.dice = Array.isArray(s.dice) && s.dice.length === 2 ? s.dice : [0, 0];
  s.remainingMoves = Array.isArray(s.remainingMoves) ? s.remainingMoves : [];
  s.opening = s.opening && typeof s.opening === "object" ? s.opening : { resolved: false, rolls: {} };
  s.opening.rolls = plainMap(s.opening.rolls);
  s.scores = plainMap(s.scores);
  ensureColors(s);
  return s;
}
__name(repairState, "repairState");
function other(c) {
  return c === "white" ? "black" : "white";
}
__name(other, "other");
function colorOf(s, userId) {
  const colors = ensureColors(s);
  return colors[String(userId)] || null;
}
__name(colorOf, "colorOf");
var nodeCrypto = { randomInt: /* @__PURE__ */ __name((min, max) => {
  const range = max - min;
  const limit = Math.floor(4294967296 / range) * range;
  const data = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(data);
  } while (data[0] >= limit);
  return min + data[0] % range;
}, "randomInt") };
function rollDie() {
  if (nodeCrypto && nodeCrypto.randomInt) return 1 + nodeCrypto.randomInt(0, 6);
  return 1 + Math.floor(Math.random() * 6);
}
__name(rollDie, "rollDie");
function rollPair() {
  return [rollDie(), rollDie()];
}
__name(rollPair, "rollPair");
function rollTotal(r) {
  return Array.isArray(r) ? Number(r[0] || 0) + Number(r[1] || 0) : Number(r || 0);
}
__name(rollTotal, "rollTotal");
function movesFromRoll(r) {
  return r[0] === r[1] ? [r[0], r[0], r[0], r[0]] : [...r];
}
__name(movesFromRoll, "movesFromRoll");
function direction(c) {
  return c === "white" ? -1 : 1;
}
__name(direction, "direction");
function homeRange(c) {
  return c === "white" ? [0, 5] : [18, 23];
}
__name(homeRange, "homeRange");
function allInHome(s, c) {
  if (s.bar[c]) return false;
  const [lo, hi] = homeRange(c);
  return s.board.every((p, i) => !p[c] || i >= lo && i <= hi);
}
__name(allInHome, "allInHome");
function canBearOff(s, c, from, die) {
  if (!allInHome(s, c)) return false;
  const target = from + direction(c) * die;
  if (c === "white") {
    if (target === -1) return true;
    if (target > -1) return false;
    return !s.board.some((p, i) => i > from && i <= 5 && p.white > 0);
  }
  if (target === 24) return true;
  if (target < 24) return false;
  return !s.board.some((p, i) => i < from && i >= 18 && p.black > 0);
}
__name(canBearOff, "canBearOff");
function entryPoint(c, die) {
  return c === "white" ? 24 - die : die - 1;
}
__name(entryPoint, "entryPoint");
function openPoint(s, c, to) {
  return to >= 0 && to < 24 && s.board[to][other(c)] < 2;
}
__name(openPoint, "openPoint");
function movesForDie(s, c, die) {
  const moves = [];
  if (s.bar[c] > 0) {
    const to = entryPoint(c, die);
    if (openPoint(s, c, to)) moves.push({ type: "move", from: "bar", to, die, dice: [die] });
    return moves;
  }
  for (let from = 0; from < 24; from++) {
    if (!s.board[from][c]) continue;
    const to = from + direction(c) * die;
    if (to >= 0 && to < 24) {
      if (openPoint(s, c, to)) moves.push({ type: "move", from, to, die, dice: [die] });
    } else if (canBearOff(s, c, from, die)) moves.push({ type: "move", from, to: "home", die, dice: [die] });
  }
  return moves;
}
__name(movesForDie, "movesForDie");
function orderedDiePairs(values) {
  const out = [], seen = /* @__PURE__ */ new Set();
  for (let i = 0; i < values.length; i++) for (let j = 0; j < values.length; j++) {
    if (i === j) continue;
    const k = values[i] + "," + values[j];
    if (!seen.has(k)) {
      seen.add(k);
      out.push([values[i], values[j]]);
    }
  }
  return out;
}
__name(orderedDiePairs, "orderedDiePairs");
function sameDice(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
}
__name(sameDice, "sameDice");
function compositeMoves(s, c) {
  const moves = [], pairs = orderedDiePairs(s.remainingMoves || []), dir3 = direction(c);
  if (!pairs.length) return moves;
  const starts = s.bar[c] > 0 ? ["bar"] : Array.from({ length: 24 }, (_, f) => f).filter((f) => s.board[f][c] > 0);
  for (const from of starts) {
    for (const pair of pairs) {
      const d1 = pair[0], d2 = pair[1], mid = from === "bar" ? entryPoint(c, d1) : from + dir3 * d1;
      if (!(mid >= 0 && mid < 24)) continue;
      if (!openPoint(s, c, mid)) continue;
      const fin = mid + dir3 * d2;
      let to = null;
      if (fin >= 0 && fin < 24) {
        if (!openPoint(s, c, fin)) continue;
        to = fin;
      } else {
        if (from === "bar") continue;
        let ok = false;
        s.board[from][c]--;
        s.board[mid][c]++;
        try {
          ok = canBearOff(s, c, mid, d2);
        } finally {
          s.board[from][c]++;
          s.board[mid][c]--;
        }
        if (!ok) continue;
        to = "home";
      }
      moves.push({ type: "move", from, to, die: d2, via: mid, dice: [d1, d2] });
    }
  }
  return moves;
}
__name(compositeMoves, "compositeMoves");
function probeAfter(s, c, o, m) {
  const p = { board: s.board.map((q) => ({ white: q.white, black: q.black })), bar: { white: s.bar.white, black: s.bar.black }, home: { white: s.home.white, black: s.home.black } };
  if (m.from === "bar") p.bar[c]--;
  else p.board[m.from][c]--;
  if (m.to === "home") p.home[c]++;
  else {
    if (p.board[m.to][o] === 1) {
      p.board[m.to][o] = 0;
      p.bar[o]++;
    }
    p.board[m.to][c]++;
  }
  return p;
}
__name(probeAfter, "probeAfter");
function bothDicePlayable(s, c, d1, d2, s1, s2) {
  const o = other(c);
  for (const m1 of s1) {
    if (movesForDie(probeAfter(s, c, o, m1), c, d2).length) return true;
  }
  for (const m2 of s2) {
    if (movesForDie(probeAfter(s, c, o, m2), c, d1).length) return true;
  }
  return false;
}
__name(bothDicePlayable, "bothDicePlayable");
function legalMoves(s, userId) {
  if (s.status !== "active" || String(s.turn) !== String(userId) || !s.rolled) return [];
  const c = colorOf(s, userId);
  if (!c) return [];
  const dice = [...new Set(s.remainingMoves || [])], singles = [];
  dice.forEach((d) => singles.push(...movesForDie(s, c, d)));
  const comps = compositeMoves(s, c);
  if (dice.length === 2 && !comps.length) {
    const s1 = movesForDie(s, c, dice[0]), s2 = movesForDie(s, c, dice[1]);
    if (s1.length && s2.length && !bothDicePlayable(s, c, dice[0], dice[1], s1, s2)) {
      const hi = Math.max(dice[0], dice[1]);
      return singles.filter((m) => m.die === hi);
    }
  }
  return singles.concat(comps);
}
__name(legalMoves, "legalMoves");
function advance(s) {
  s.turn = s.players[(s.players.findIndex((p) => String(p) === String(s.turn)) + 1) % s.players.length];
  s.dice = [0, 0];
  s.remainingMoves = [];
  s.rolled = false;
}
__name(advance, "advance");
function createGame2(params = {}) {
  const players = (params.playerIds || ["p1", "p2"]).map(String).slice(0, 2);
  const preferred = params.preferredStarter && players.includes(String(params.preferredStarter)) ? String(params.preferredStarter) : null;
  const colors = {};
  if (players[0]) colors[players[0]] = "white";
  if (players[1]) colors[players[1]] = "black";
  return { engine: "tawla", version: 7, status: "waiting", turn: preferred, players, colors, board: setupBoard(), bar: { white: 0, black: 0 }, home: { white: 0, black: 0 }, dice: [0, 0], remainingMoves: [], rolled: false, opening: { resolved: Boolean(preferred), rolls: {}, winner: preferred }, finished: false, winner: null, moveCount: 0, scores: plainMap(params.scores), roundNumber: Number(params.roundNumber) || 1, lastRound: params.lastRound || null, createdAt: /* @__PURE__ */ new Date() };
}
__name(createGame2, "createGame");
function openingPlayer(s) {
  const rolls = plainMap(s.opening && s.opening.rolls);
  if (!rolls[String(s.players[0])]) return String(s.players[0]);
  if (!rolls[String(s.players[1])]) return String(s.players[1]);
  return null;
}
__name(openingPlayer, "openingPlayer");
function applyAction2(s, userId, action = {}) {
  action = action && typeof action === "object" ? action : {};
  repairState(s);
  userId = String(userId);
  if (s.status !== "active") return { error: "\u0627\u0644\u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0646\u0634\u0637\u0629" };
  const players = s.players.map(String);
  if (!players.includes(userId)) return { error: "\u0623\u0646\u062A \u0644\u0633\u062A \u0644\u0627\u0639\u0628\u064B\u0627" };
  if (action.type === "choose-color" && !s.opening.resolved && Number(s.moveCount || 0) === 0) {
    const wanted = action.color;
    if (!["white", "black"].includes(wanted)) return { error: "\u0644\u0648\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" };
    const colors = ensureColors(s), otherId = players.find((id) => id !== userId);
    colors[userId] = wanted;
    if (otherId) colors[otherId] = other(wanted);
    s.colors = colors;
    return { ok: true, state: s, colors };
  }
  if (!s.opening.resolved) {
    if (action.type !== "opening-roll") return { error: "\u064A\u062C\u0628 \u0625\u0643\u0645\u0627\u0644 \u0631\u0645\u064A\u0629 \u0627\u0644\u0628\u062F\u0627\u064A\u0629 \u0623\u0648\u0644\u064B\u0627" };
    const expected = openingPlayer(s);
    if (expected !== userId) return { error: "\u0627\u0646\u062A\u0638\u0631 \u0631\u0645\u064A\u0629 \u0627\u0644\u0644\u0627\u0639\u0628 \u0627\u0644\u0622\u062E\u0631" };
    const rolls = plainMap(s.opening.rolls);
    rolls[userId] = rollPair();
    s.opening.rolls = rolls;
    if (Object.keys(rolls).length === s.players.length) {
      const ra = rolls[String(s.players[0])], rb = rolls[String(s.players[1])], a = rollTotal(ra), b = rollTotal(rb);
      if (a === b) {
        s.opening.rolls = {};
        s.turn = null;
        return { ok: true, state: s, tie: true };
      }
      s.turn = a > b ? s.players[0] : s.players[1];
      s.opening.winner = String(s.turn);
      s.opening.resolved = true;
      s.dice = [0, 0];
      s.remainingMoves = [];
      s.rolled = false;
    }
    return { ok: true, state: s };
  }
  if (String(s.turn) !== userId) return { error: "\u0644\u064A\u0633 \u062F\u0648\u0631\u0643" };
  const c = colorOf(s, userId);
  if (!c) return { error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0644\u0648\u0646 \u0627\u0644\u0644\u0627\u0639\u0628" };
  const opp = other(c);
  if (action.type === "roll") {
    if (s.rolled) return { error: "\u062A\u0645 \u0631\u0645\u064A \u0627\u0644\u0632\u0647\u0631 \u0628\u0627\u0644\u0641\u0639\u0644" };
    s.dice = rollPair();
    s.remainingMoves = movesFromRoll(s.dice);
    s.rolled = true;
    if (!legalMoves(s, userId).length) advance(s);
    return { ok: true, state: s };
  }
  if (action.type !== "move") return { error: "\u062D\u0631\u0643\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629" };
  const legal = legalMoves(s, userId), from = action.from === "bar" ? "bar" : Number(action.from), to = action.to === "home" ? "home" : Number(action.to), wantDice = Array.isArray(action.dice) ? action.dice.map(Number) : null, viaWant = action.via == null ? null : Number(action.via);
  const move = legal.find((m) => m.from === from && m.to === to && (wantDice ? sameDice(m.dice, wantDice) && (viaWant == null || m.via === viaWant) : m.die === Number(action.die) && m.dice.length === 1));
  if (!move) return { error: "\u0647\u0630\u0647 \u0627\u0644\u062D\u0631\u0643\u0629 \u0644\u0627 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u0632\u0647\u0631" };
  if (from === "bar") s.bar[c] -= 1;
  else s.board[from][c] -= 1;
  if (to === "home") s.home[c] += 1;
  else {
    if (s.board[to][opp] === 1) {
      s.board[to][opp] = 0;
      s.bar[opp] += 1;
    }
    s.board[to][c] += 1;
  }
  if (typeof move.via === "number" && s.board[move.via][opp] === 1) {
    s.board[move.via][opp] = 0;
    s.bar[opp] += 1;
  }
  for (const dd of move.dice || [move.die]) {
    const di = s.remainingMoves.indexOf(dd);
    if (di >= 0) s.remainingMoves.splice(di, 1);
  }
  s.moveCount += 1;
  if (s.home[c] >= 15) {
    const points2 = s.home[opp] === 0 ? 2 : 1;
    s.finished = true;
    s.status = "finished";
    s.winner = userId;
    s.scores = plainMap(s.scores);
    s.scores[userId] = Number(s.scores[userId] || 0) + points2;
    s.lastRound = { winner: userId, points: points2, roundNumber: s.roundNumber };
    return { ok: true, state: s };
  }
  if (!s.remainingMoves.length || !legalMoves(s, userId).length) advance(s);
  return { ok: true, state: s };
}
__name(applyAction2, "applyAction");
function getLegalActions(s, userId) {
  repairState(s);
  userId = String(userId);
  if (s.status !== "active") return [];
  if (!s.opening.resolved) {
    const expected = openingPlayer(s), actions = [];
    if (expected === userId) actions.push({ type: "opening-roll" });
    if (Number(s.moveCount || 0) === 0) actions.push({ type: "choose-color", colors: ["white", "black"] });
    return actions;
  }
  if (String(s.turn) !== userId) return [];
  if (!s.rolled) return [{ type: "roll" }];
  return legalMoves(s, userId);
}
__name(getLegalActions, "getLegalActions");
function getPublicState2(s) {
  repairState(s);
  return { status: s.status, turn: s.turn, players: s.players, colors: plainMap(s.colors), board: s.board, bar: s.bar, home: s.home, dice: s.dice, remainingMoves: s.remainingMoves || [], rolled: s.rolled, finished: s.finished, winner: s.winner, moveCount: s.moveCount || 0, opening: s.opening, scores: plainMap(s.scores), roundNumber: s.roundNumber || 1, lastRound: s.lastRound || null };
}
__name(getPublicState2, "getPublicState");
function getPrivateState2(s, userId) {
  repairState(s);
  return { myColor: colorOf(s, String(userId)), turn: String(s.turn) === String(userId), rolled: s.rolled, remainingMoves: s.remainingMoves || [] };
}
__name(getPrivateState2, "getPrivateState");
function isFinished2(s) {
  return !!s.finished;
}
__name(isFinished2, "isFinished");
function getWinner2(s) {
  return s.winner || null;
}
__name(getWinner2, "getWinner");
function serialize2(s) {
  return JSON.stringify(getPublicState2(s));
}
__name(serialize2, "serialize");
var engine2 = { createGame: createGame2, getPublicState: getPublicState2, getPrivateState: getPrivateState2, getLegalActions, applyAction: applyAction2, isFinished: isFinished2, getWinner: getWinner2, serialize: serialize2 };
var tawla_engine_default = engine2;

// node_modules/chess.js/dist/esm/chess.js
function rootNode(comment) {
  return comment !== null ? { comment, variations: [] } : { variations: [] };
}
__name(rootNode, "rootNode");
function node(move, suffix, nag, comment, variations) {
  const node2 = { move, variations };
  if (suffix) {
    node2.suffix = suffix;
  }
  if (nag) {
    node2.nag = nag;
  }
  if (comment !== null) {
    node2.comment = comment;
  }
  return node2;
}
__name(node, "node");
function lineToTree(...nodes) {
  const [root, ...rest] = nodes;
  let parent = root;
  for (const child of rest) {
    if (child !== null) {
      parent.variations = [child, ...child.variations];
      child.variations = [];
      parent = child;
    }
  }
  return root;
}
__name(lineToTree, "lineToTree");
function pgn(headers, game) {
  if (game.marker && game.marker.comment) {
    let node2 = game.root;
    while (true) {
      const next = node2.variations[0];
      if (!next) {
        node2.comment = game.marker.comment;
        break;
      }
      node2 = next;
    }
  }
  return {
    headers,
    root: game.root,
    result: (game.marker && game.marker.result) ?? void 0
  };
}
__name(pgn, "pgn");
function peg$subclass(child, parent) {
  function C() {
    this.constructor = child;
  }
  __name(C, "C");
  C.prototype = parent.prototype;
  child.prototype = new C();
}
__name(peg$subclass, "peg$subclass");
function peg$SyntaxError(message, expected, found, location) {
  var self = Error.call(this, message);
  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(self, peg$SyntaxError.prototype);
  }
  self.expected = expected;
  self.found = found;
  self.location = location;
  self.name = "SyntaxError";
  return self;
}
__name(peg$SyntaxError, "peg$SyntaxError");
peg$subclass(peg$SyntaxError, Error);
function peg$padEnd(str, targetLength, padString) {
  padString = padString || " ";
  if (str.length > targetLength) {
    return str;
  }
  targetLength -= str.length;
  padString += padString.repeat(targetLength);
  return str + padString.slice(0, targetLength);
}
__name(peg$padEnd, "peg$padEnd");
peg$SyntaxError.prototype.format = function(sources) {
  var str = "Error: " + this.message;
  if (this.location) {
    var src = null;
    var k;
    for (k = 0; k < sources.length; k++) {
      if (sources[k].source === this.location.source) {
        src = sources[k].text.split(/\r\n|\n|\r/g);
        break;
      }
    }
    var s = this.location.start;
    var offset_s = this.location.source && typeof this.location.source.offset === "function" ? this.location.source.offset(s) : s;
    var loc = this.location.source + ":" + offset_s.line + ":" + offset_s.column;
    if (src) {
      var e = this.location.end;
      var filler = peg$padEnd("", offset_s.line.toString().length, " ");
      var line = src[s.line - 1];
      var last = s.line === e.line ? e.column : line.length + 1;
      var hatLen = last - s.column || 1;
      str += "\n --> " + loc + "\n" + filler + " |\n" + offset_s.line + " | " + line + "\n" + filler + " | " + peg$padEnd("", s.column - 1, " ") + peg$padEnd("", hatLen, "^");
    } else {
      str += "\n at " + loc;
    }
  }
  return str;
};
peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
    literal: /* @__PURE__ */ __name(function(expectation) {
      return '"' + literalEscape(expectation.text) + '"';
    }, "literal"),
    class: /* @__PURE__ */ __name(function(expectation) {
      var escapedParts = expectation.parts.map(function(part) {
        return Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part);
      });
      return "[" + (expectation.inverted ? "^" : "") + escapedParts.join("") + "]";
    }, "class"),
    any: /* @__PURE__ */ __name(function() {
      return "any character";
    }, "any"),
    end: /* @__PURE__ */ __name(function() {
      return "end of input";
    }, "end"),
    other: /* @__PURE__ */ __name(function(expectation) {
      return expectation.description;
    }, "other")
  };
  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }
  __name(hex, "hex");
  function literalEscape(s) {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
      return "\\x0" + hex(ch);
    }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
      return "\\x" + hex(ch);
    });
  }
  __name(literalEscape, "literalEscape");
  function classEscape(s) {
    return s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
      return "\\x0" + hex(ch);
    }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
      return "\\x" + hex(ch);
    });
  }
  __name(classEscape, "classEscape");
  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }
  __name(describeExpectation, "describeExpectation");
  function describeExpected(expected2) {
    var descriptions = expected2.map(describeExpectation);
    var i, j;
    descriptions.sort();
    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }
    switch (descriptions.length) {
      case 1:
        return descriptions[0];
      case 2:
        return descriptions[0] + " or " + descriptions[1];
      default:
        return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
    }
  }
  __name(describeExpected, "describeExpected");
  function describeFound(found2) {
    return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
  }
  __name(describeFound, "describeFound");
  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};
function peg$parse(input, options) {
  options = options !== void 0 ? options : {};
  var peg$FAILED = {};
  var peg$source = options.grammarSource;
  var peg$startRuleFunctions = { pgn: peg$parsepgn };
  var peg$startRuleFunction = peg$parsepgn;
  var peg$c0 = "[";
  var peg$c1 = '"';
  var peg$c2 = "]";
  var peg$c3 = ".";
  var peg$c4 = "O-O-O";
  var peg$c5 = "O-O";
  var peg$c6 = "0-0-0";
  var peg$c7 = "0-0";
  var peg$c8 = "$";
  var peg$c9 = "{";
  var peg$c10 = "}";
  var peg$c11 = ";";
  var peg$c12 = "(";
  var peg$c13 = ")";
  var peg$c14 = "1-0";
  var peg$c15 = "0-1";
  var peg$c16 = "1/2-1/2";
  var peg$c17 = "*";
  var peg$r0 = /^[a-zA-Z]/;
  var peg$r1 = /^[^"]/;
  var peg$r2 = /^[0-9]/;
  var peg$r3 = /^[.]/;
  var peg$r4 = /^[a-zA-Z1-8\-=]/;
  var peg$r5 = /^[+#]/;
  var peg$r6 = /^[!?]/;
  var peg$r7 = /^[^}]/;
  var peg$r8 = /^[^\r\n]/;
  var peg$r9 = /^[ \t\r\n]/;
  var peg$e0 = peg$otherExpectation("tag pair");
  var peg$e1 = peg$literalExpectation("[", false);
  var peg$e2 = peg$literalExpectation('"', false);
  var peg$e3 = peg$literalExpectation("]", false);
  var peg$e4 = peg$otherExpectation("tag name");
  var peg$e5 = peg$classExpectation([["a", "z"], ["A", "Z"]], false, false);
  var peg$e6 = peg$otherExpectation("tag value");
  var peg$e7 = peg$classExpectation(['"'], true, false);
  var peg$e8 = peg$otherExpectation("move number");
  var peg$e9 = peg$classExpectation([["0", "9"]], false, false);
  var peg$e10 = peg$literalExpectation(".", false);
  var peg$e11 = peg$classExpectation(["."], false, false);
  var peg$e12 = peg$otherExpectation("standard algebraic notation");
  var peg$e13 = peg$literalExpectation("O-O-O", false);
  var peg$e14 = peg$literalExpectation("O-O", false);
  var peg$e15 = peg$literalExpectation("0-0-0", false);
  var peg$e16 = peg$literalExpectation("0-0", false);
  var peg$e17 = peg$classExpectation([["a", "z"], ["A", "Z"], ["1", "8"], "-", "="], false, false);
  var peg$e18 = peg$classExpectation(["+", "#"], false, false);
  var peg$e19 = peg$otherExpectation("suffix annotation");
  var peg$e20 = peg$classExpectation(["!", "?"], false, false);
  var peg$e21 = peg$otherExpectation("NAG");
  var peg$e22 = peg$literalExpectation("$", false);
  var peg$e23 = peg$otherExpectation("brace comment");
  var peg$e24 = peg$literalExpectation("{", false);
  var peg$e25 = peg$classExpectation(["}"], true, false);
  var peg$e26 = peg$literalExpectation("}", false);
  var peg$e27 = peg$otherExpectation("rest of line comment");
  var peg$e28 = peg$literalExpectation(";", false);
  var peg$e29 = peg$classExpectation(["\r", "\n"], true, false);
  var peg$e30 = peg$otherExpectation("variation");
  var peg$e31 = peg$literalExpectation("(", false);
  var peg$e32 = peg$literalExpectation(")", false);
  var peg$e33 = peg$otherExpectation("game termination marker");
  var peg$e34 = peg$literalExpectation("1-0", false);
  var peg$e35 = peg$literalExpectation("0-1", false);
  var peg$e36 = peg$literalExpectation("1/2-1/2", false);
  var peg$e37 = peg$literalExpectation("*", false);
  var peg$e38 = peg$otherExpectation("whitespace");
  var peg$e39 = peg$classExpectation([" ", "	", "\r", "\n"], false, false);
  var peg$f0 = /* @__PURE__ */ __name(function(headers, game) {
    return pgn(headers, game);
  }, "peg$f0");
  var peg$f1 = /* @__PURE__ */ __name(function(tagPairs) {
    return Object.fromEntries(tagPairs);
  }, "peg$f1");
  var peg$f2 = /* @__PURE__ */ __name(function(tagName, tagValue) {
    return [tagName, tagValue];
  }, "peg$f2");
  var peg$f3 = /* @__PURE__ */ __name(function(root, marker) {
    return { root, marker };
  }, "peg$f3");
  var peg$f4 = /* @__PURE__ */ __name(function(comment, moves) {
    return lineToTree(rootNode(comment), ...moves.flat());
  }, "peg$f4");
  var peg$f5 = /* @__PURE__ */ __name(function(san, suffix, nag, comment, variations) {
    return node(san, suffix, nag, comment, variations);
  }, "peg$f5");
  var peg$f6 = /* @__PURE__ */ __name(function(nag) {
    return nag;
  }, "peg$f6");
  var peg$f7 = /* @__PURE__ */ __name(function(comment) {
    return comment.replace(/[\r\n]+/g, " ");
  }, "peg$f7");
  var peg$f8 = /* @__PURE__ */ __name(function(comment) {
    return comment.trim();
  }, "peg$f8");
  var peg$f9 = /* @__PURE__ */ __name(function(line) {
    return line;
  }, "peg$f9");
  var peg$f10 = /* @__PURE__ */ __name(function(result, comment) {
    return { result, comment };
  }, "peg$f10");
  var peg$currPos = options.peg$currPos | 0;
  var peg$posDetailsCache = [{ line: 1, column: 1 }];
  var peg$maxFailPos = peg$currPos;
  var peg$maxFailExpected = options.peg$maxFailExpected || [];
  var peg$silentFails = options.peg$silentFails | 0;
  var peg$result;
  if (options.startRule) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
    }
    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }
  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text, ignoreCase };
  }
  __name(peg$literalExpectation, "peg$literalExpectation");
  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts, inverted, ignoreCase };
  }
  __name(peg$classExpectation, "peg$classExpectation");
  function peg$endExpectation() {
    return { type: "end" };
  }
  __name(peg$endExpectation, "peg$endExpectation");
  function peg$otherExpectation(description) {
    return { type: "other", description };
  }
  __name(peg$otherExpectation, "peg$otherExpectation");
  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos];
    var p;
    if (details) {
      return details;
    } else {
      if (pos >= peg$posDetailsCache.length) {
        p = peg$posDetailsCache.length - 1;
      } else {
        p = pos;
        while (!peg$posDetailsCache[--p]) {
        }
      }
      details = peg$posDetailsCache[p];
      details = {
        line: details.line,
        column: details.column
      };
      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }
        p++;
      }
      peg$posDetailsCache[pos] = details;
      return details;
    }
  }
  __name(peg$computePosDetails, "peg$computePosDetails");
  function peg$computeLocation(startPos, endPos, offset) {
    var startPosDetails = peg$computePosDetails(startPos);
    var endPosDetails = peg$computePosDetails(endPos);
    var res = {
      source: peg$source,
      start: {
        offset: startPos,
        line: startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line: endPosDetails.line,
        column: endPosDetails.column
      }
    };
    return res;
  }
  __name(peg$computeLocation, "peg$computeLocation");
  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) {
      return;
    }
    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }
    peg$maxFailExpected.push(expected);
  }
  __name(peg$fail, "peg$fail");
  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }
  __name(peg$buildStructuredError, "peg$buildStructuredError");
  function peg$parsepgn() {
    var s0, s1, s2;
    s0 = peg$currPos;
    s1 = peg$parsetagPairSection();
    s2 = peg$parsemoveTextSection();
    s0 = peg$f0(s1, s2);
    return s0;
  }
  __name(peg$parsepgn, "peg$parsepgn");
  function peg$parsetagPairSection() {
    var s0, s1, s2;
    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsetagPair();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsetagPair();
    }
    s2 = peg$parse_();
    s0 = peg$f1(s1);
    return s0;
  }
  __name(peg$parsetagPairSection, "peg$parsetagPairSection");
  function peg$parsetagPair() {
    var s0, s2, s4, s6, s7, s8, s10;
    peg$silentFails++;
    s0 = peg$currPos;
    peg$parse_();
    if (input.charCodeAt(peg$currPos) === 91) {
      s2 = peg$c0;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e1);
      }
    }
    if (s2 !== peg$FAILED) {
      peg$parse_();
      s4 = peg$parsetagName();
      if (s4 !== peg$FAILED) {
        peg$parse_();
        if (input.charCodeAt(peg$currPos) === 34) {
          s6 = peg$c1;
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e2);
          }
        }
        if (s6 !== peg$FAILED) {
          s7 = peg$parsetagValue();
          if (input.charCodeAt(peg$currPos) === 34) {
            s8 = peg$c1;
            peg$currPos++;
          } else {
            s8 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e2);
            }
          }
          if (s8 !== peg$FAILED) {
            peg$parse_();
            if (input.charCodeAt(peg$currPos) === 93) {
              s10 = peg$c2;
              peg$currPos++;
            } else {
              s10 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e3);
              }
            }
            if (s10 !== peg$FAILED) {
              s0 = peg$f2(s4, s7);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      if (peg$silentFails === 0) {
        peg$fail(peg$e0);
      }
    }
    return s0;
  }
  __name(peg$parsetagPair, "peg$parsetagPair");
  function peg$parsetagName() {
    var s0, s1, s2;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r0.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e5);
      }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r0.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e5);
          }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s0 = input.substring(s0, peg$currPos);
    } else {
      s0 = s1;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e4);
      }
    }
    return s0;
  }
  __name(peg$parsetagName, "peg$parsetagName");
  function peg$parsetagValue() {
    var s0, s1, s2;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r1.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e7);
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = input.charAt(peg$currPos);
      if (peg$r1.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e7);
        }
      }
    }
    s0 = input.substring(s0, peg$currPos);
    peg$silentFails--;
    s1 = peg$FAILED;
    if (peg$silentFails === 0) {
      peg$fail(peg$e6);
    }
    return s0;
  }
  __name(peg$parsetagValue, "peg$parsetagValue");
  function peg$parsemoveTextSection() {
    var s0, s1, s3;
    s0 = peg$currPos;
    s1 = peg$parseline();
    peg$parse_();
    s3 = peg$parsegameTerminationMarker();
    if (s3 === peg$FAILED) {
      s3 = null;
    }
    peg$parse_();
    s0 = peg$f3(s1, s3);
    return s0;
  }
  __name(peg$parsemoveTextSection, "peg$parsemoveTextSection");
  function peg$parseline() {
    var s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parsecomment();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    s2 = [];
    s3 = peg$parsemove();
    while (s3 !== peg$FAILED) {
      s2.push(s3);
      s3 = peg$parsemove();
    }
    s0 = peg$f4(s1, s2);
    return s0;
  }
  __name(peg$parseline, "peg$parseline");
  function peg$parsemove() {
    var s0, s4, s5, s6, s7, s8, s9, s10;
    s0 = peg$currPos;
    peg$parse_();
    peg$parsemoveNumber();
    peg$parse_();
    s4 = peg$parsesan();
    if (s4 !== peg$FAILED) {
      s5 = peg$parsesuffixAnnotation();
      if (s5 === peg$FAILED) {
        s5 = null;
      }
      s6 = [];
      s7 = peg$parsenag();
      while (s7 !== peg$FAILED) {
        s6.push(s7);
        s7 = peg$parsenag();
      }
      s7 = peg$parse_();
      s8 = peg$parsecomment();
      if (s8 === peg$FAILED) {
        s8 = null;
      }
      s9 = [];
      s10 = peg$parsevariation();
      while (s10 !== peg$FAILED) {
        s9.push(s10);
        s10 = peg$parsevariation();
      }
      s0 = peg$f5(s4, s5, s6, s8, s9);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  __name(peg$parsemove, "peg$parsemove");
  function peg$parsemoveNumber() {
    var s0, s1, s2, s3, s4, s5;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r2.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e9);
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = input.charAt(peg$currPos);
      if (peg$r2.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e9);
        }
      }
    }
    if (input.charCodeAt(peg$currPos) === 46) {
      s2 = peg$c3;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e10);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parse_();
      s4 = [];
      s5 = input.charAt(peg$currPos);
      if (peg$r3.test(s5)) {
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e11);
        }
      }
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = input.charAt(peg$currPos);
        if (peg$r3.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e11);
          }
        }
      }
      s1 = [s1, s2, s3, s4];
      s0 = s1;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e8);
      }
    }
    return s0;
  }
  __name(peg$parsemoveNumber, "peg$parsemoveNumber");
  function peg$parsesan() {
    var s0, s1, s2, s3, s4, s5;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c4) {
      s2 = peg$c4;
      peg$currPos += 5;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e13);
      }
    }
    if (s2 === peg$FAILED) {
      if (input.substr(peg$currPos, 3) === peg$c5) {
        s2 = peg$c5;
        peg$currPos += 3;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e14);
        }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c6) {
          s2 = peg$c6;
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e15);
          }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c7) {
            s2 = peg$c7;
            peg$currPos += 3;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e16);
            }
          }
          if (s2 === peg$FAILED) {
            s2 = peg$currPos;
            s3 = input.charAt(peg$currPos);
            if (peg$r0.test(s3)) {
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e5);
              }
            }
            if (s3 !== peg$FAILED) {
              s4 = [];
              s5 = input.charAt(peg$currPos);
              if (peg$r4.test(s5)) {
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e17);
                }
              }
              if (s5 !== peg$FAILED) {
                while (s5 !== peg$FAILED) {
                  s4.push(s5);
                  s5 = input.charAt(peg$currPos);
                  if (peg$r4.test(s5)) {
                    peg$currPos++;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$e17);
                    }
                  }
                }
              } else {
                s4 = peg$FAILED;
              }
              if (s4 !== peg$FAILED) {
                s3 = [s3, s4];
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$FAILED;
            }
          }
        }
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = input.charAt(peg$currPos);
      if (peg$r5.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e18);
        }
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s2 = [s2, s3];
      s1 = s2;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s0 = input.substring(s0, peg$currPos);
    } else {
      s0 = s1;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e12);
      }
    }
    return s0;
  }
  __name(peg$parsesan, "peg$parsesan");
  function peg$parsesuffixAnnotation() {
    var s0, s1, s2;
    peg$silentFails++;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r6.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e20);
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      if (s1.length >= 2) {
        s2 = peg$FAILED;
      } else {
        s2 = input.charAt(peg$currPos);
        if (peg$r6.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e20);
          }
        }
      }
    }
    if (s1.length < 1) {
      peg$currPos = s0;
      s0 = peg$FAILED;
    } else {
      s0 = s1;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e19);
      }
    }
    return s0;
  }
  __name(peg$parsesuffixAnnotation, "peg$parsesuffixAnnotation");
  function peg$parsenag() {
    var s0, s2, s3, s4, s5;
    peg$silentFails++;
    s0 = peg$currPos;
    peg$parse_();
    if (input.charCodeAt(peg$currPos) === 36) {
      s2 = peg$c8;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e22);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$currPos;
      s4 = [];
      s5 = input.charAt(peg$currPos);
      if (peg$r2.test(s5)) {
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e9);
        }
      }
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = input.charAt(peg$currPos);
          if (peg$r2.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e9);
            }
          }
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s3 = input.substring(s3, peg$currPos);
      } else {
        s3 = s4;
      }
      if (s3 !== peg$FAILED) {
        s0 = peg$f6(s3);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      if (peg$silentFails === 0) {
        peg$fail(peg$e21);
      }
    }
    return s0;
  }
  __name(peg$parsenag, "peg$parsenag");
  function peg$parsecomment() {
    var s0;
    s0 = peg$parsebraceComment();
    if (s0 === peg$FAILED) {
      s0 = peg$parserestOfLineComment();
    }
    return s0;
  }
  __name(peg$parsecomment, "peg$parsecomment");
  function peg$parsebraceComment() {
    var s0, s1, s2, s3, s4;
    peg$silentFails++;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 123) {
      s1 = peg$c9;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e24);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = [];
      s4 = input.charAt(peg$currPos);
      if (peg$r7.test(s4)) {
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e25);
        }
      }
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        s4 = input.charAt(peg$currPos);
        if (peg$r7.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e25);
          }
        }
      }
      s2 = input.substring(s2, peg$currPos);
      if (input.charCodeAt(peg$currPos) === 125) {
        s3 = peg$c10;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e26);
        }
      }
      if (s3 !== peg$FAILED) {
        s0 = peg$f7(s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e23);
      }
    }
    return s0;
  }
  __name(peg$parsebraceComment, "peg$parsebraceComment");
  function peg$parserestOfLineComment() {
    var s0, s1, s2, s3, s4;
    peg$silentFails++;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 59) {
      s1 = peg$c11;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e28);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = [];
      s4 = input.charAt(peg$currPos);
      if (peg$r8.test(s4)) {
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e29);
        }
      }
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        s4 = input.charAt(peg$currPos);
        if (peg$r8.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e29);
          }
        }
      }
      s2 = input.substring(s2, peg$currPos);
      s0 = peg$f8(s2);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e27);
      }
    }
    return s0;
  }
  __name(peg$parserestOfLineComment, "peg$parserestOfLineComment");
  function peg$parsevariation() {
    var s0, s2, s3, s5;
    peg$silentFails++;
    s0 = peg$currPos;
    peg$parse_();
    if (input.charCodeAt(peg$currPos) === 40) {
      s2 = peg$c12;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e31);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parseline();
      if (s3 !== peg$FAILED) {
        peg$parse_();
        if (input.charCodeAt(peg$currPos) === 41) {
          s5 = peg$c13;
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e32);
          }
        }
        if (s5 !== peg$FAILED) {
          s0 = peg$f9(s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      if (peg$silentFails === 0) {
        peg$fail(peg$e30);
      }
    }
    return s0;
  }
  __name(peg$parsevariation, "peg$parsevariation");
  function peg$parsegameTerminationMarker() {
    var s0, s1, s3;
    peg$silentFails++;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c14) {
      s1 = peg$c14;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e34);
      }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 3) === peg$c15) {
        s1 = peg$c15;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e35);
        }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 7) === peg$c16) {
          s1 = peg$c16;
          peg$currPos += 7;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e36);
          }
        }
        if (s1 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 42) {
            s1 = peg$c17;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e37);
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$parse_();
      s3 = peg$parsecomment();
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s0 = peg$f10(s1, s3);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    peg$silentFails--;
    if (s0 === peg$FAILED) {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e33);
      }
    }
    return s0;
  }
  __name(peg$parsegameTerminationMarker, "peg$parsegameTerminationMarker");
  function peg$parse_() {
    var s0, s1;
    peg$silentFails++;
    s0 = [];
    s1 = input.charAt(peg$currPos);
    if (peg$r9.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e39);
      }
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = input.charAt(peg$currPos);
      if (peg$r9.test(s1)) {
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e39);
        }
      }
    }
    peg$silentFails--;
    s1 = peg$FAILED;
    if (peg$silentFails === 0) {
      peg$fail(peg$e38);
    }
    return s0;
  }
  __name(peg$parse_, "peg$parse_");
  peg$result = peg$startRuleFunction();
  if (options.peg$library) {
    return (
      /** @type {any} */
      {
        peg$result,
        peg$currPos,
        peg$FAILED,
        peg$maxFailExpected,
        peg$maxFailPos
      }
    );
  }
  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }
    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}
__name(peg$parse, "peg$parse");
var MASK64 = 0xffffffffffffffffn;
function rotl(x, k) {
  return (x << k | x >> 64n - k) & 0xffffffffffffffffn;
}
__name(rotl, "rotl");
function wrappingMul(x, y) {
  return x * y & MASK64;
}
__name(wrappingMul, "wrappingMul");
function xoroshiro128(state) {
  return function() {
    let s0 = BigInt(state & MASK64);
    let s1 = BigInt(state >> 64n & MASK64);
    const result = wrappingMul(rotl(wrappingMul(s0, 5n), 7n), 9n);
    s1 ^= s0;
    s0 = (rotl(s0, 24n) ^ s1 ^ s1 << 16n) & MASK64;
    s1 = rotl(s1, 37n);
    state = s1 << 64n | s0;
    return result;
  };
}
__name(xoroshiro128, "xoroshiro128");
var rand = xoroshiro128(0xa187eb39cdcaed8f31c4b365b102e01en);
var PIECE_KEYS = Array.from({ length: 2 }, () => Array.from({ length: 6 }, () => Array.from({ length: 128 }, () => rand())));
var EP_KEYS = Array.from({ length: 8 }, () => rand());
var CASTLING_KEYS = Array.from({ length: 16 }, () => rand());
var SIDE_KEY = rand();
var WHITE = "w";
var BLACK = "b";
var PAWN = "p";
var KNIGHT = "n";
var BISHOP = "b";
var ROOK = "r";
var QUEEN = "q";
var KING = "k";
var DEFAULT_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
var Move = class {
  static {
    __name(this, "Move");
  }
  color;
  from;
  to;
  piece;
  captured;
  promotion;
  /**
   * @deprecated This field is deprecated and will be removed in version 2.0.0.
   * Please use move descriptor functions instead: `isCapture`, `isPromotion`,
   * `isEnPassant`, `isKingsideCastle`, `isQueensideCastle`, `isCastle`, and
   * `isBigPawn`
   */
  flags;
  san;
  lan;
  before;
  after;
  constructor(chess, internal) {
    const { color, piece, from, to, flags, captured, promotion } = internal;
    const fromAlgebraic = algebraic(from);
    const toAlgebraic = algebraic(to);
    this.color = color;
    this.piece = piece;
    this.from = fromAlgebraic;
    this.to = toAlgebraic;
    this.san = chess["_moveToSan"](internal, chess["_moves"]({ legal: true }));
    this.lan = fromAlgebraic + toAlgebraic;
    this.before = chess.fen();
    chess["_makeMove"](internal);
    this.after = chess.fen();
    chess["_undoMove"]();
    this.flags = "";
    for (const flag in BITS) {
      if (BITS[flag] & flags) {
        this.flags += FLAGS[flag];
      }
    }
    if (captured) {
      this.captured = captured;
    }
    if (promotion) {
      this.promotion = promotion;
      this.lan += promotion;
    }
  }
  isCapture() {
    return this.flags.indexOf(FLAGS["CAPTURE"]) > -1;
  }
  isPromotion() {
    return this.flags.indexOf(FLAGS["PROMOTION"]) > -1;
  }
  isEnPassant() {
    return this.flags.indexOf(FLAGS["EP_CAPTURE"]) > -1;
  }
  isKingsideCastle() {
    return this.flags.indexOf(FLAGS["KSIDE_CASTLE"]) > -1;
  }
  isQueensideCastle() {
    return this.flags.indexOf(FLAGS["QSIDE_CASTLE"]) > -1;
  }
  isBigPawn() {
    return this.flags.indexOf(FLAGS["BIG_PAWN"]) > -1;
  }
};
var EMPTY = -1;
var FLAGS = {
  NORMAL: "n",
  CAPTURE: "c",
  BIG_PAWN: "b",
  EP_CAPTURE: "e",
  PROMOTION: "p",
  KSIDE_CASTLE: "k",
  QSIDE_CASTLE: "q",
  NULL_MOVE: "-"
};
var BITS = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,
  EP_CAPTURE: 8,
  PROMOTION: 16,
  KSIDE_CASTLE: 32,
  QSIDE_CASTLE: 64,
  NULL_MOVE: 128
};
var SEVEN_TAG_ROSTER = {
  Event: "?",
  Site: "?",
  Date: "????.??.??",
  Round: "?",
  White: "?",
  Black: "?",
  Result: "*"
};
var SUPLEMENTAL_TAGS = {
  WhiteTitle: null,
  BlackTitle: null,
  WhiteElo: null,
  BlackElo: null,
  WhiteUSCF: null,
  BlackUSCF: null,
  WhiteNA: null,
  BlackNA: null,
  WhiteType: null,
  BlackType: null,
  EventDate: null,
  EventSponsor: null,
  Section: null,
  Stage: null,
  Board: null,
  Opening: null,
  Variation: null,
  SubVariation: null,
  ECO: null,
  NIC: null,
  Time: null,
  UTCTime: null,
  UTCDate: null,
  TimeControl: null,
  SetUp: null,
  FEN: null,
  Termination: null,
  Annotator: null,
  Mode: null,
  PlyCount: null
};
var HEADER_TEMPLATE = {
  ...SEVEN_TAG_ROSTER,
  ...SUPLEMENTAL_TAGS
};
var Ox88 = {
  a8: 0,
  b8: 1,
  c8: 2,
  d8: 3,
  e8: 4,
  f8: 5,
  g8: 6,
  h8: 7,
  a7: 16,
  b7: 17,
  c7: 18,
  d7: 19,
  e7: 20,
  f7: 21,
  g7: 22,
  h7: 23,
  a6: 32,
  b6: 33,
  c6: 34,
  d6: 35,
  e6: 36,
  f6: 37,
  g6: 38,
  h6: 39,
  a5: 48,
  b5: 49,
  c5: 50,
  d5: 51,
  e5: 52,
  f5: 53,
  g5: 54,
  h5: 55,
  a4: 64,
  b4: 65,
  c4: 66,
  d4: 67,
  e4: 68,
  f4: 69,
  g4: 70,
  h4: 71,
  a3: 80,
  b3: 81,
  c3: 82,
  d3: 83,
  e3: 84,
  f3: 85,
  g3: 86,
  h3: 87,
  a2: 96,
  b2: 97,
  c2: 98,
  d2: 99,
  e2: 100,
  f2: 101,
  g2: 102,
  h2: 103,
  a1: 112,
  b1: 113,
  c1: 114,
  d1: 115,
  e1: 116,
  f1: 117,
  g1: 118,
  h1: 119
};
var PAWN_OFFSETS = {
  b: [16, 32, 17, 15],
  w: [-16, -32, -17, -15]
};
var PIECE_OFFSETS = {
  n: [-18, -33, -31, -14, 18, 33, 31, 14],
  b: [-17, -15, 17, 15],
  r: [-16, 1, 16, -1],
  q: [-17, -16, -15, 1, 17, 16, 15, -1],
  k: [-17, -16, -15, 1, 17, 16, 15, -1]
};
var ATTACKS = [
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  24,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  2,
  24,
  2,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  53,
  56,
  53,
  2,
  0,
  0,
  0,
  0,
  0,
  0,
  24,
  24,
  24,
  24,
  24,
  24,
  56,
  0,
  56,
  24,
  24,
  24,
  24,
  24,
  24,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  53,
  56,
  53,
  2,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  2,
  24,
  2,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  24,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  0,
  20,
  0,
  0,
  20,
  0,
  0,
  0,
  0,
  0,
  0,
  24,
  0,
  0,
  0,
  0,
  0,
  0,
  20
];
var RAYS = [
  17,
  0,
  0,
  0,
  0,
  0,
  0,
  16,
  0,
  0,
  0,
  0,
  0,
  0,
  15,
  0,
  0,
  17,
  0,
  0,
  0,
  0,
  0,
  16,
  0,
  0,
  0,
  0,
  0,
  15,
  0,
  0,
  0,
  0,
  17,
  0,
  0,
  0,
  0,
  16,
  0,
  0,
  0,
  0,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  17,
  0,
  0,
  0,
  16,
  0,
  0,
  0,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  17,
  0,
  0,
  16,
  0,
  0,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  17,
  0,
  16,
  0,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  17,
  16,
  15,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  -16,
  -17,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  0,
  -16,
  0,
  -17,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  0,
  0,
  -16,
  0,
  0,
  -17,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  0,
  0,
  0,
  -16,
  0,
  0,
  0,
  -17,
  0,
  0,
  0,
  0,
  0,
  0,
  -15,
  0,
  0,
  0,
  0,
  -16,
  0,
  0,
  0,
  0,
  -17,
  0,
  0,
  0,
  0,
  -15,
  0,
  0,
  0,
  0,
  0,
  -16,
  0,
  0,
  0,
  0,
  0,
  -17,
  0,
  0,
  -15,
  0,
  0,
  0,
  0,
  0,
  0,
  -16,
  0,
  0,
  0,
  0,
  0,
  0,
  -17
];
var PIECE_MASKS = { p: 1, n: 2, b: 4, r: 8, q: 16, k: 32 };
var SYMBOLS = "pnbrqkPNBRQK";
var PROMOTIONS = [KNIGHT, BISHOP, ROOK, QUEEN];
var RANK_1 = 7;
var RANK_2 = 6;
var RANK_7 = 1;
var RANK_8 = 0;
var SIDES = {
  [KING]: BITS.KSIDE_CASTLE,
  [QUEEN]: BITS.QSIDE_CASTLE
};
var ROOKS = {
  w: [
    { square: Ox88.a1, flag: BITS.QSIDE_CASTLE },
    { square: Ox88.h1, flag: BITS.KSIDE_CASTLE }
  ],
  b: [
    { square: Ox88.a8, flag: BITS.QSIDE_CASTLE },
    { square: Ox88.h8, flag: BITS.KSIDE_CASTLE }
  ]
};
var SECOND_RANK = { b: RANK_7, w: RANK_2 };
var SAN_NULLMOVE = "--";
function rank(square) {
  return square >> 4;
}
__name(rank, "rank");
function file(square) {
  return square & 15;
}
__name(file, "file");
function isDigit(c) {
  return "0123456789".indexOf(c) !== -1;
}
__name(isDigit, "isDigit");
function algebraic(square) {
  const f = file(square);
  const r = rank(square);
  return "abcdefgh".substring(f, f + 1) + "87654321".substring(r, r + 1);
}
__name(algebraic, "algebraic");
function swapColor(color) {
  return color === WHITE ? BLACK : WHITE;
}
__name(swapColor, "swapColor");
function validateFen(fen) {
  const tokens = fen.split(/\s+/);
  if (tokens.length !== 6) {
    return {
      ok: false,
      error: "Invalid FEN: must contain six space-delimited fields"
    };
  }
  const moveNumber = parseInt(tokens[5], 10);
  if (isNaN(moveNumber) || moveNumber <= 0) {
    return {
      ok: false,
      error: "Invalid FEN: move number must be a positive integer"
    };
  }
  const halfMoves = parseInt(tokens[4], 10);
  if (isNaN(halfMoves) || halfMoves < 0) {
    return {
      ok: false,
      error: "Invalid FEN: half move counter number must be a non-negative integer"
    };
  }
  if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
    return { ok: false, error: "Invalid FEN: en-passant square is invalid" };
  }
  if (/[^kKqQ-]/.test(tokens[2])) {
    return { ok: false, error: "Invalid FEN: castling availability is invalid" };
  }
  if (!/^(w|b)$/.test(tokens[1])) {
    return { ok: false, error: "Invalid FEN: side-to-move is invalid" };
  }
  const rows = tokens[0].split("/");
  if (rows.length !== 8) {
    return {
      ok: false,
      error: "Invalid FEN: piece data does not contain 8 '/'-delimited rows"
    };
  }
  for (let i = 0; i < rows.length; i++) {
    let sumFields = 0;
    let previousWasNumber = false;
    for (let k = 0; k < rows[i].length; k++) {
      if (isDigit(rows[i][k])) {
        if (previousWasNumber) {
          return {
            ok: false,
            error: "Invalid FEN: piece data is invalid (consecutive number)"
          };
        }
        sumFields += parseInt(rows[i][k], 10);
        previousWasNumber = true;
      } else {
        if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
          return {
            ok: false,
            error: "Invalid FEN: piece data is invalid (invalid piece)"
          };
        }
        sumFields += 1;
        previousWasNumber = false;
      }
    }
    if (sumFields !== 8) {
      return {
        ok: false,
        error: "Invalid FEN: piece data is invalid (too many squares in rank)"
      };
    }
  }
  if (tokens[3][1] == "3" && tokens[1] == "w" || tokens[3][1] == "6" && tokens[1] == "b") {
    return { ok: false, error: "Invalid FEN: illegal en-passant square" };
  }
  const kings = [
    { color: "white", regex: /K/g },
    { color: "black", regex: /k/g }
  ];
  for (const { color, regex } of kings) {
    if (!regex.test(tokens[0])) {
      return { ok: false, error: `Invalid FEN: missing ${color} king` };
    }
    if ((tokens[0].match(regex) || []).length > 1) {
      return { ok: false, error: `Invalid FEN: too many ${color} kings` };
    }
  }
  if (Array.from(rows[0] + rows[7]).some((char) => char.toUpperCase() === "P")) {
    return {
      ok: false,
      error: "Invalid FEN: some pawns are on the edge rows"
    };
  }
  return { ok: true };
}
__name(validateFen, "validateFen");
function getDisambiguator(move, moves) {
  const from = move.from;
  const to = move.to;
  const piece = move.piece;
  let ambiguities = 0;
  let sameRank = 0;
  let sameFile = 0;
  for (let i = 0, len = moves.length; i < len; i++) {
    const ambigFrom = moves[i].from;
    const ambigTo = moves[i].to;
    const ambigPiece = moves[i].piece;
    if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
      ambiguities++;
      if (rank(from) === rank(ambigFrom)) {
        sameRank++;
      }
      if (file(from) === file(ambigFrom)) {
        sameFile++;
      }
    }
  }
  if (ambiguities > 0) {
    if (sameRank > 0 && sameFile > 0) {
      return algebraic(from);
    } else if (sameFile > 0) {
      return algebraic(from).charAt(1);
    } else {
      return algebraic(from).charAt(0);
    }
  }
  return "";
}
__name(getDisambiguator, "getDisambiguator");
function addMove(moves, color, from, to, piece, captured = void 0, flags = BITS.NORMAL) {
  const r = rank(to);
  if (piece === PAWN && (r === RANK_1 || r === RANK_8)) {
    for (let i = 0; i < PROMOTIONS.length; i++) {
      const promotion = PROMOTIONS[i];
      moves.push({
        color,
        from,
        to,
        piece,
        captured,
        promotion,
        flags: flags | BITS.PROMOTION
      });
    }
  } else {
    moves.push({
      color,
      from,
      to,
      piece,
      captured,
      flags
    });
  }
}
__name(addMove, "addMove");
function inferPieceType(san) {
  let pieceType = san.charAt(0);
  if (pieceType >= "a" && pieceType <= "h") {
    const matches = san.match(/[a-h]\d.*[a-h]\d/);
    if (matches) {
      return void 0;
    }
    return PAWN;
  }
  pieceType = pieceType.toLowerCase();
  if (pieceType === "o") {
    return KING;
  }
  return pieceType;
}
__name(inferPieceType, "inferPieceType");
function strippedSan(move) {
  return move.replace(/=/, "").replace(/[+#]?[?!]*$/, "");
}
__name(strippedSan, "strippedSan");
var Chess = class {
  static {
    __name(this, "Chess");
  }
  _board = new Array(128);
  _turn = WHITE;
  _header = {};
  _kings = { w: EMPTY, b: EMPTY };
  _epSquare = -1;
  _halfMoves = 0;
  _moveNumber = 0;
  _history = [];
  _comments = {};
  _castling = { w: 0, b: 0 };
  _hash = 0n;
  // tracks number of times a position has been seen for repetition checking
  _positionCount = /* @__PURE__ */ new Map();
  constructor(fen = DEFAULT_POSITION, { skipValidation = false } = {}) {
    this.load(fen, { skipValidation });
  }
  clear({ preserveHeaders = false } = {}) {
    this._board = new Array(128);
    this._kings = { w: EMPTY, b: EMPTY };
    this._turn = WHITE;
    this._castling = { w: 0, b: 0 };
    this._epSquare = EMPTY;
    this._halfMoves = 0;
    this._moveNumber = 1;
    this._history = [];
    this._comments = {};
    this._header = preserveHeaders ? this._header : { ...HEADER_TEMPLATE };
    this._hash = this._computeHash();
    this._positionCount = /* @__PURE__ */ new Map();
    this._header["SetUp"] = null;
    this._header["FEN"] = null;
  }
  load(fen, { skipValidation = false, preserveHeaders = false } = {}) {
    let tokens = fen.split(/\s+/);
    if (tokens.length >= 2 && tokens.length < 6) {
      const adjustments = ["-", "-", "0", "1"];
      fen = tokens.concat(adjustments.slice(-(6 - tokens.length))).join(" ");
    }
    tokens = fen.split(/\s+/);
    if (!skipValidation) {
      const { ok, error: error3 } = validateFen(fen);
      if (!ok) {
        throw new Error(error3);
      }
    }
    const position = tokens[0];
    let square = 0;
    this.clear({ preserveHeaders });
    for (let i = 0; i < position.length; i++) {
      const piece = position.charAt(i);
      if (piece === "/") {
        square += 8;
      } else if (isDigit(piece)) {
        square += parseInt(piece, 10);
      } else {
        const color = piece < "a" ? WHITE : BLACK;
        this._put({ type: piece.toLowerCase(), color }, algebraic(square));
        square++;
      }
    }
    this._turn = tokens[1];
    if (tokens[2].indexOf("K") > -1) {
      this._castling.w |= BITS.KSIDE_CASTLE;
    }
    if (tokens[2].indexOf("Q") > -1) {
      this._castling.w |= BITS.QSIDE_CASTLE;
    }
    if (tokens[2].indexOf("k") > -1) {
      this._castling.b |= BITS.KSIDE_CASTLE;
    }
    if (tokens[2].indexOf("q") > -1) {
      this._castling.b |= BITS.QSIDE_CASTLE;
    }
    this._epSquare = tokens[3] === "-" ? EMPTY : Ox88[tokens[3]];
    this._halfMoves = parseInt(tokens[4], 10);
    this._moveNumber = parseInt(tokens[5], 10);
    this._hash = this._computeHash();
    this._updateSetup(fen);
    this._incPositionCount();
  }
  fen({ forceEnpassantSquare = false } = {}) {
    let empty = 0;
    let fen = "";
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      if (this._board[i]) {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        const { color, type: piece } = this._board[i];
        fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
      } else {
        empty++;
      }
      if (i + 1 & 136) {
        if (empty > 0) {
          fen += empty;
        }
        if (i !== Ox88.h1) {
          fen += "/";
        }
        empty = 0;
        i += 8;
      }
    }
    let castling = "";
    if (this._castling[WHITE] & BITS.KSIDE_CASTLE) {
      castling += "K";
    }
    if (this._castling[WHITE] & BITS.QSIDE_CASTLE) {
      castling += "Q";
    }
    if (this._castling[BLACK] & BITS.KSIDE_CASTLE) {
      castling += "k";
    }
    if (this._castling[BLACK] & BITS.QSIDE_CASTLE) {
      castling += "q";
    }
    castling = castling || "-";
    let epSquare = "-";
    if (this._epSquare !== EMPTY) {
      if (forceEnpassantSquare) {
        epSquare = algebraic(this._epSquare);
      } else {
        const bigPawnSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
        const squares = [bigPawnSquare + 1, bigPawnSquare - 1];
        for (const square of squares) {
          if (square & 136) {
            continue;
          }
          const color = this._turn;
          if (this._board[square]?.color === color && this._board[square]?.type === PAWN) {
            this._makeMove({
              color,
              from: square,
              to: this._epSquare,
              piece: PAWN,
              captured: PAWN,
              flags: BITS.EP_CAPTURE
            });
            const isLegal = !this._isKingAttacked(color);
            this._undoMove();
            if (isLegal) {
              epSquare = algebraic(this._epSquare);
              break;
            }
          }
        }
      }
    }
    return [
      fen,
      this._turn,
      castling,
      epSquare,
      this._halfMoves,
      this._moveNumber
    ].join(" ");
  }
  _pieceKey(i) {
    if (!this._board[i]) {
      return 0n;
    }
    const { color, type } = this._board[i];
    const colorIndex = {
      w: 0,
      b: 1
    }[color];
    const typeIndex = {
      p: 0,
      n: 1,
      b: 2,
      r: 3,
      q: 4,
      k: 5
    }[type];
    return PIECE_KEYS[colorIndex][typeIndex][i];
  }
  _epKey() {
    return this._epSquare === EMPTY ? 0n : EP_KEYS[this._epSquare & 7];
  }
  _castlingKey() {
    const index = this._castling.w >> 5 | this._castling.b >> 3;
    return CASTLING_KEYS[index];
  }
  _computeHash() {
    let hash = 0n;
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      if (i & 136) {
        i += 7;
        continue;
      }
      if (this._board[i]) {
        hash ^= this._pieceKey(i);
      }
    }
    hash ^= this._epKey();
    hash ^= this._castlingKey();
    if (this._turn === "b") {
      hash ^= SIDE_KEY;
    }
    return hash;
  }
  /*
   * Called when the initial board setup is changed with put() or remove().
   * modifies the SetUp and FEN properties of the header object. If the FEN
   * is equal to the default position, the SetUp and FEN are deleted the setup
   * is only updated if history.length is zero, ie moves haven't been made.
   */
  _updateSetup(fen) {
    if (this._history.length > 0)
      return;
    if (fen !== DEFAULT_POSITION) {
      this._header["SetUp"] = "1";
      this._header["FEN"] = fen;
    } else {
      this._header["SetUp"] = null;
      this._header["FEN"] = null;
    }
  }
  reset() {
    this.load(DEFAULT_POSITION);
  }
  get(square) {
    return this._board[Ox88[square]];
  }
  findPiece(piece) {
    const squares = [];
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      if (i & 136) {
        i += 7;
        continue;
      }
      if (!this._board[i] || this._board[i]?.color !== piece.color) {
        continue;
      }
      if (this._board[i].color === piece.color && this._board[i].type === piece.type) {
        squares.push(algebraic(i));
      }
    }
    return squares;
  }
  put({ type, color }, square) {
    if (this._put({ type, color }, square)) {
      this._updateCastlingRights();
      this._updateEnPassantSquare();
      this._updateSetup(this.fen());
      return true;
    }
    return false;
  }
  _set(sq, piece) {
    this._hash ^= this._pieceKey(sq);
    this._board[sq] = piece;
    this._hash ^= this._pieceKey(sq);
  }
  _put({ type, color }, square) {
    if (SYMBOLS.indexOf(type.toLowerCase()) === -1) {
      return false;
    }
    if (!(square in Ox88)) {
      return false;
    }
    const sq = Ox88[square];
    if (type == KING && !(this._kings[color] == EMPTY || this._kings[color] == sq)) {
      return false;
    }
    const currentPieceOnSquare = this._board[sq];
    if (currentPieceOnSquare && currentPieceOnSquare.type === KING) {
      this._kings[currentPieceOnSquare.color] = EMPTY;
    }
    this._set(sq, { type, color });
    if (type === KING) {
      this._kings[color] = sq;
    }
    return true;
  }
  _clear(sq) {
    this._hash ^= this._pieceKey(sq);
    delete this._board[sq];
  }
  remove(square) {
    const piece = this.get(square);
    this._clear(Ox88[square]);
    if (piece && piece.type === KING) {
      this._kings[piece.color] = EMPTY;
    }
    this._updateCastlingRights();
    this._updateEnPassantSquare();
    this._updateSetup(this.fen());
    return piece;
  }
  _updateCastlingRights() {
    this._hash ^= this._castlingKey();
    const whiteKingInPlace = this._board[Ox88.e1]?.type === KING && this._board[Ox88.e1]?.color === WHITE;
    const blackKingInPlace = this._board[Ox88.e8]?.type === KING && this._board[Ox88.e8]?.color === BLACK;
    if (!whiteKingInPlace || this._board[Ox88.a1]?.type !== ROOK || this._board[Ox88.a1]?.color !== WHITE) {
      this._castling.w &= -65;
    }
    if (!whiteKingInPlace || this._board[Ox88.h1]?.type !== ROOK || this._board[Ox88.h1]?.color !== WHITE) {
      this._castling.w &= -33;
    }
    if (!blackKingInPlace || this._board[Ox88.a8]?.type !== ROOK || this._board[Ox88.a8]?.color !== BLACK) {
      this._castling.b &= -65;
    }
    if (!blackKingInPlace || this._board[Ox88.h8]?.type !== ROOK || this._board[Ox88.h8]?.color !== BLACK) {
      this._castling.b &= -33;
    }
    this._hash ^= this._castlingKey();
  }
  _updateEnPassantSquare() {
    if (this._epSquare === EMPTY) {
      return;
    }
    const startSquare = this._epSquare + (this._turn === WHITE ? -16 : 16);
    const currentSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
    const attackers = [currentSquare + 1, currentSquare - 1];
    if (this._board[startSquare] !== null || this._board[this._epSquare] !== null || this._board[currentSquare]?.color !== swapColor(this._turn) || this._board[currentSquare]?.type !== PAWN) {
      this._hash ^= this._epKey();
      this._epSquare = EMPTY;
      return;
    }
    const canCapture = /* @__PURE__ */ __name((square) => !(square & 136) && this._board[square]?.color === this._turn && this._board[square]?.type === PAWN, "canCapture");
    if (!attackers.some(canCapture)) {
      this._hash ^= this._epKey();
      this._epSquare = EMPTY;
    }
  }
  _attacked(color, square, verbose) {
    const attackers = [];
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      if (i & 136) {
        i += 7;
        continue;
      }
      if (this._board[i] === void 0 || this._board[i].color !== color) {
        continue;
      }
      const piece = this._board[i];
      const difference = i - square;
      if (difference === 0) {
        continue;
      }
      const index = difference + 119;
      if (ATTACKS[index] & PIECE_MASKS[piece.type]) {
        if (piece.type === PAWN) {
          if (difference > 0 && piece.color === WHITE || difference <= 0 && piece.color === BLACK) {
            if (!verbose) {
              return true;
            } else {
              attackers.push(algebraic(i));
            }
          }
          continue;
        }
        if (piece.type === "n" || piece.type === "k") {
          if (!verbose) {
            return true;
          } else {
            attackers.push(algebraic(i));
            continue;
          }
        }
        const offset = RAYS[index];
        let j = i + offset;
        let blocked = false;
        while (j !== square) {
          if (this._board[j] != null) {
            blocked = true;
            break;
          }
          j += offset;
        }
        if (!blocked) {
          if (!verbose) {
            return true;
          } else {
            attackers.push(algebraic(i));
            continue;
          }
        }
      }
    }
    if (verbose) {
      return attackers;
    } else {
      return false;
    }
  }
  attackers(square, attackedBy) {
    if (!attackedBy) {
      return this._attacked(this._turn, Ox88[square], true);
    } else {
      return this._attacked(attackedBy, Ox88[square], true);
    }
  }
  _isKingAttacked(color) {
    const square = this._kings[color];
    return square === -1 ? false : this._attacked(swapColor(color), square);
  }
  hash() {
    return this._hash.toString(16);
  }
  isAttacked(square, attackedBy) {
    return this._attacked(attackedBy, Ox88[square]);
  }
  isCheck() {
    return this._isKingAttacked(this._turn);
  }
  inCheck() {
    return this.isCheck();
  }
  isCheckmate() {
    return this.isCheck() && this._moves().length === 0;
  }
  isStalemate() {
    return !this.isCheck() && this._moves().length === 0;
  }
  isInsufficientMaterial() {
    const pieces = {
      b: 0,
      n: 0,
      r: 0,
      q: 0,
      k: 0,
      p: 0
    };
    const bishops = [];
    let numPieces = 0;
    let squareColor = 0;
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      squareColor = (squareColor + 1) % 2;
      if (i & 136) {
        i += 7;
        continue;
      }
      const piece = this._board[i];
      if (piece) {
        pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1;
        if (piece.type === BISHOP) {
          bishops.push(squareColor);
        }
        numPieces++;
      }
    }
    if (numPieces === 2) {
      return true;
    } else if (
      // k vs. kn .... or .... k vs. kb
      numPieces === 3 && (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
    ) {
      return true;
    } else if (numPieces === pieces[BISHOP] + 2) {
      let sum = 0;
      const len = bishops.length;
      for (let i = 0; i < len; i++) {
        sum += bishops[i];
      }
      if (sum === 0 || sum === len) {
        return true;
      }
    }
    return false;
  }
  isThreefoldRepetition() {
    return this._getPositionCount(this._hash) >= 3;
  }
  isDrawByFiftyMoves() {
    return this._halfMoves >= 100;
  }
  isDraw() {
    return this.isDrawByFiftyMoves() || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition();
  }
  isGameOver() {
    return this.isCheckmate() || this.isDraw();
  }
  moves({ verbose = false, square = void 0, piece = void 0 } = {}) {
    const moves = this._moves({ square, piece });
    if (verbose) {
      return moves.map((move) => new Move(this, move));
    } else {
      return moves.map((move) => this._moveToSan(move, moves));
    }
  }
  _moves({ legal = true, piece = void 0, square = void 0 } = {}) {
    const forSquare = square ? square.toLowerCase() : void 0;
    const forPiece = piece?.toLowerCase();
    const moves = [];
    const us = this._turn;
    const them = swapColor(us);
    let firstSquare = Ox88.a8;
    let lastSquare = Ox88.h1;
    let singleSquare = false;
    if (forSquare) {
      if (!(forSquare in Ox88)) {
        return [];
      } else {
        firstSquare = lastSquare = Ox88[forSquare];
        singleSquare = true;
      }
    }
    for (let from = firstSquare; from <= lastSquare; from++) {
      if (from & 136) {
        from += 7;
        continue;
      }
      if (!this._board[from] || this._board[from].color === them) {
        continue;
      }
      const { type } = this._board[from];
      let to;
      if (type === PAWN) {
        if (forPiece && forPiece !== type)
          continue;
        to = from + PAWN_OFFSETS[us][0];
        if (!this._board[to]) {
          addMove(moves, us, from, to, PAWN);
          to = from + PAWN_OFFSETS[us][1];
          if (SECOND_RANK[us] === rank(from) && !this._board[to]) {
            addMove(moves, us, from, to, PAWN, void 0, BITS.BIG_PAWN);
          }
        }
        for (let j = 2; j < 4; j++) {
          to = from + PAWN_OFFSETS[us][j];
          if (to & 136)
            continue;
          if (this._board[to]?.color === them) {
            addMove(moves, us, from, to, PAWN, this._board[to].type, BITS.CAPTURE);
          } else if (to === this._epSquare) {
            addMove(moves, us, from, to, PAWN, PAWN, BITS.EP_CAPTURE);
          }
        }
      } else {
        if (forPiece && forPiece !== type)
          continue;
        for (let j = 0, len = PIECE_OFFSETS[type].length; j < len; j++) {
          const offset = PIECE_OFFSETS[type][j];
          to = from;
          while (true) {
            to += offset;
            if (to & 136)
              break;
            if (!this._board[to]) {
              addMove(moves, us, from, to, type);
            } else {
              if (this._board[to].color === us)
                break;
              addMove(moves, us, from, to, type, this._board[to].type, BITS.CAPTURE);
              break;
            }
            if (type === KNIGHT || type === KING)
              break;
          }
        }
      }
    }
    if (forPiece === void 0 || forPiece === KING) {
      if (!singleSquare || lastSquare === this._kings[us]) {
        if (this._castling[us] & BITS.KSIDE_CASTLE) {
          const castlingFrom = this._kings[us];
          const castlingTo = castlingFrom + 2;
          if (!this._board[castlingFrom + 1] && !this._board[castlingTo] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom + 1) && !this._attacked(them, castlingTo)) {
            addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.KSIDE_CASTLE);
          }
        }
        if (this._castling[us] & BITS.QSIDE_CASTLE) {
          const castlingFrom = this._kings[us];
          const castlingTo = castlingFrom - 2;
          if (!this._board[castlingFrom - 1] && !this._board[castlingFrom - 2] && !this._board[castlingFrom - 3] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom - 1) && !this._attacked(them, castlingTo)) {
            addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.QSIDE_CASTLE);
          }
        }
      }
    }
    if (!legal || this._kings[us] === -1) {
      return moves;
    }
    const legalMoves2 = [];
    for (let i = 0, len = moves.length; i < len; i++) {
      this._makeMove(moves[i]);
      if (!this._isKingAttacked(us)) {
        legalMoves2.push(moves[i]);
      }
      this._undoMove();
    }
    return legalMoves2;
  }
  move(move, { strict = false } = {}) {
    let moveObj = null;
    if (typeof move === "string") {
      moveObj = this._moveFromSan(move, strict);
    } else if (move === null) {
      moveObj = this._moveFromSan(SAN_NULLMOVE, strict);
    } else if (typeof move === "object") {
      const moves = this._moves();
      for (let i = 0, len = moves.length; i < len; i++) {
        if (move.from === algebraic(moves[i].from) && move.to === algebraic(moves[i].to) && (!("promotion" in moves[i]) || move.promotion === moves[i].promotion)) {
          moveObj = moves[i];
          break;
        }
      }
    }
    if (!moveObj) {
      if (typeof move === "string") {
        throw new Error(`Invalid move: ${move}`);
      } else {
        throw new Error(`Invalid move: ${JSON.stringify(move)}`);
      }
    }
    if (this.isCheck() && moveObj.flags & BITS.NULL_MOVE) {
      throw new Error("Null move not allowed when in check");
    }
    const prettyMove = new Move(this, moveObj);
    this._makeMove(moveObj);
    this._incPositionCount();
    return prettyMove;
  }
  _push(move) {
    this._history.push({
      move,
      kings: { b: this._kings.b, w: this._kings.w },
      turn: this._turn,
      castling: { b: this._castling.b, w: this._castling.w },
      epSquare: this._epSquare,
      halfMoves: this._halfMoves,
      moveNumber: this._moveNumber
    });
  }
  _movePiece(from, to) {
    this._hash ^= this._pieceKey(from);
    this._board[to] = this._board[from];
    delete this._board[from];
    this._hash ^= this._pieceKey(to);
  }
  _makeMove(move) {
    const us = this._turn;
    const them = swapColor(us);
    this._push(move);
    if (move.flags & BITS.NULL_MOVE) {
      if (us === BLACK) {
        this._moveNumber++;
      }
      this._halfMoves++;
      this._turn = them;
      this._epSquare = EMPTY;
      return;
    }
    this._hash ^= this._epKey();
    this._hash ^= this._castlingKey();
    if (move.captured) {
      this._hash ^= this._pieceKey(move.to);
    }
    this._movePiece(move.from, move.to);
    if (move.flags & BITS.EP_CAPTURE) {
      if (this._turn === BLACK) {
        this._clear(move.to - 16);
      } else {
        this._clear(move.to + 16);
      }
    }
    if (move.promotion) {
      this._clear(move.to);
      this._set(move.to, { type: move.promotion, color: us });
    }
    if (this._board[move.to].type === KING) {
      this._kings[us] = move.to;
      if (move.flags & BITS.KSIDE_CASTLE) {
        const castlingTo = move.to - 1;
        const castlingFrom = move.to + 1;
        this._movePiece(castlingFrom, castlingTo);
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        const castlingTo = move.to + 1;
        const castlingFrom = move.to - 2;
        this._movePiece(castlingFrom, castlingTo);
      }
      this._castling[us] = 0;
    }
    if (this._castling[us]) {
      for (let i = 0, len = ROOKS[us].length; i < len; i++) {
        if (move.from === ROOKS[us][i].square && this._castling[us] & ROOKS[us][i].flag) {
          this._castling[us] ^= ROOKS[us][i].flag;
          break;
        }
      }
    }
    if (this._castling[them]) {
      for (let i = 0, len = ROOKS[them].length; i < len; i++) {
        if (move.to === ROOKS[them][i].square && this._castling[them] & ROOKS[them][i].flag) {
          this._castling[them] ^= ROOKS[them][i].flag;
          break;
        }
      }
    }
    this._hash ^= this._castlingKey();
    if (move.flags & BITS.BIG_PAWN) {
      let epSquare;
      if (us === BLACK) {
        epSquare = move.to - 16;
      } else {
        epSquare = move.to + 16;
      }
      if (!(move.to - 1 & 136) && this._board[move.to - 1]?.type === PAWN && this._board[move.to - 1]?.color === them || !(move.to + 1 & 136) && this._board[move.to + 1]?.type === PAWN && this._board[move.to + 1]?.color === them) {
        this._epSquare = epSquare;
        this._hash ^= this._epKey();
      } else {
        this._epSquare = EMPTY;
      }
    } else {
      this._epSquare = EMPTY;
    }
    if (move.piece === PAWN) {
      this._halfMoves = 0;
    } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      this._halfMoves = 0;
    } else {
      this._halfMoves++;
    }
    if (us === BLACK) {
      this._moveNumber++;
    }
    this._turn = them;
    this._hash ^= SIDE_KEY;
  }
  undo() {
    const hash = this._hash;
    const move = this._undoMove();
    if (move) {
      const prettyMove = new Move(this, move);
      this._decPositionCount(hash);
      return prettyMove;
    }
    return null;
  }
  _undoMove() {
    const old = this._history.pop();
    if (old === void 0) {
      return null;
    }
    this._hash ^= this._epKey();
    this._hash ^= this._castlingKey();
    const move = old.move;
    this._kings = old.kings;
    this._turn = old.turn;
    this._castling = old.castling;
    this._epSquare = old.epSquare;
    this._halfMoves = old.halfMoves;
    this._moveNumber = old.moveNumber;
    this._hash ^= this._epKey();
    this._hash ^= this._castlingKey();
    this._hash ^= SIDE_KEY;
    const us = this._turn;
    const them = swapColor(us);
    if (move.flags & BITS.NULL_MOVE) {
      return move;
    }
    this._movePiece(move.to, move.from);
    if (move.piece) {
      this._clear(move.from);
      this._set(move.from, { type: move.piece, color: us });
    }
    if (move.captured) {
      if (move.flags & BITS.EP_CAPTURE) {
        let index;
        if (us === BLACK) {
          index = move.to - 16;
        } else {
          index = move.to + 16;
        }
        this._set(index, { type: PAWN, color: them });
      } else {
        this._set(move.to, { type: move.captured, color: them });
      }
    }
    if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
      let castlingTo, castlingFrom;
      if (move.flags & BITS.KSIDE_CASTLE) {
        castlingTo = move.to + 1;
        castlingFrom = move.to - 1;
      } else {
        castlingTo = move.to - 2;
        castlingFrom = move.to + 1;
      }
      this._movePiece(castlingFrom, castlingTo);
    }
    return move;
  }
  pgn({ newline = "\n", maxWidth = 0 } = {}) {
    const result = [];
    let headerExists = false;
    for (const i in this._header) {
      const headerTag = this._header[i];
      if (headerTag)
        result.push(`[${i} "${this._header[i]}"]` + newline);
      headerExists = true;
    }
    if (headerExists && this._history.length) {
      result.push(newline);
    }
    const appendComment = /* @__PURE__ */ __name((moveString2) => {
      const comment = this._comments[this.fen()];
      if (typeof comment !== "undefined") {
        const delimiter = moveString2.length > 0 ? " " : "";
        moveString2 = `${moveString2}${delimiter}{${comment}}`;
      }
      return moveString2;
    }, "appendComment");
    const reversedHistory = [];
    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove());
    }
    const moves = [];
    let moveString = "";
    if (reversedHistory.length === 0) {
      moves.push(appendComment(""));
    }
    while (reversedHistory.length > 0) {
      moveString = appendComment(moveString);
      const move = reversedHistory.pop();
      if (!move) {
        break;
      }
      if (!this._history.length && move.color === "b") {
        const prefix = `${this._moveNumber}. ...`;
        moveString = moveString ? `${moveString} ${prefix}` : prefix;
      } else if (move.color === "w") {
        if (moveString.length) {
          moves.push(moveString);
        }
        moveString = this._moveNumber + ".";
      }
      moveString = moveString + " " + this._moveToSan(move, this._moves({ legal: true }));
      this._makeMove(move);
    }
    if (moveString.length) {
      moves.push(appendComment(moveString));
    }
    moves.push(this._header.Result || "*");
    if (maxWidth === 0) {
      return result.join("") + moves.join(" ");
    }
    const strip = /* @__PURE__ */ __name(function() {
      if (result.length > 0 && result[result.length - 1] === " ") {
        result.pop();
        return true;
      }
      return false;
    }, "strip");
    const wrapComment = /* @__PURE__ */ __name(function(width, move) {
      for (const token of move.split(" ")) {
        if (!token) {
          continue;
        }
        if (width + token.length > maxWidth) {
          while (strip()) {
            width--;
          }
          result.push(newline);
          width = 0;
        }
        result.push(token);
        width += token.length;
        result.push(" ");
        width++;
      }
      if (strip()) {
        width--;
      }
      return width;
    }, "wrapComment");
    let currentWidth = 0;
    for (let i = 0; i < moves.length; i++) {
      if (currentWidth + moves[i].length > maxWidth) {
        if (moves[i].includes("{")) {
          currentWidth = wrapComment(currentWidth, moves[i]);
          continue;
        }
      }
      if (currentWidth + moves[i].length > maxWidth && i !== 0) {
        if (result[result.length - 1] === " ") {
          result.pop();
        }
        result.push(newline);
        currentWidth = 0;
      } else if (i !== 0) {
        result.push(" ");
        currentWidth++;
      }
      result.push(moves[i]);
      currentWidth += moves[i].length;
    }
    return result.join("");
  }
  /**
   * @deprecated Use `setHeader` and `getHeaders` instead. This method will return null header tags (which is not what you want)
   */
  header(...args) {
    for (let i = 0; i < args.length; i += 2) {
      if (typeof args[i] === "string" && typeof args[i + 1] === "string") {
        this._header[args[i]] = args[i + 1];
      }
    }
    return this._header;
  }
  // TODO: value validation per spec
  setHeader(key, value) {
    this._header[key] = value ?? SEVEN_TAG_ROSTER[key] ?? null;
    return this.getHeaders();
  }
  removeHeader(key) {
    if (key in this._header) {
      this._header[key] = SEVEN_TAG_ROSTER[key] || null;
      return true;
    }
    return false;
  }
  // return only non-null headers (omit placemarker nulls)
  getHeaders() {
    const nonNullHeaders = {};
    for (const [key, value] of Object.entries(this._header)) {
      if (value !== null) {
        nonNullHeaders[key] = value;
      }
    }
    return nonNullHeaders;
  }
  loadPgn(pgn2, { strict = false, newlineChar = "\r?\n" } = {}) {
    if (newlineChar !== "\r?\n") {
      pgn2 = pgn2.replace(new RegExp(newlineChar, "g"), "\n");
    }
    const parsedPgn = peg$parse(pgn2);
    this.reset();
    const headers = parsedPgn.headers;
    let fen = "";
    for (const key in headers) {
      if (key.toLowerCase() === "fen") {
        fen = headers[key];
      }
      this.header(key, headers[key]);
    }
    if (!strict) {
      if (fen) {
        this.load(fen, { preserveHeaders: true });
      }
    } else {
      if (headers["SetUp"] === "1") {
        if (!("FEN" in headers)) {
          throw new Error("Invalid PGN: FEN tag must be supplied with SetUp tag");
        }
        this.load(headers["FEN"], { preserveHeaders: true });
      }
    }
    let node2 = parsedPgn.root;
    while (node2) {
      if (node2.move) {
        const move = this._moveFromSan(node2.move, strict);
        if (move == null) {
          throw new Error(`Invalid move in PGN: ${node2.move}`);
        } else {
          this._makeMove(move);
          this._incPositionCount();
        }
      }
      if (node2.comment !== void 0) {
        this._comments[this.fen()] = node2.comment;
      }
      node2 = node2.variations[0];
    }
    const result = parsedPgn.result;
    if (result && Object.keys(this._header).length && this._header["Result"] !== result) {
      this.setHeader("Result", result);
    }
  }
  /*
   * Convert a move from 0x88 coordinates to Standard Algebraic Notation
   * (SAN)
   *
   * @param {boolean} strict Use the strict SAN parser. It will throw errors
   * on overly disambiguated moves (see below):
   *
   * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
   * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
   * 4. ... Ne7 is technically the valid SAN
   */
  _moveToSan(move, moves) {
    let output = "";
    if (move.flags & BITS.KSIDE_CASTLE) {
      output = "O-O";
    } else if (move.flags & BITS.QSIDE_CASTLE) {
      output = "O-O-O";
    } else if (move.flags & BITS.NULL_MOVE) {
      return SAN_NULLMOVE;
    } else {
      if (move.piece !== PAWN) {
        const disambiguator = getDisambiguator(move, moves);
        output += move.piece.toUpperCase() + disambiguator;
      }
      if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        if (move.piece === PAWN) {
          output += algebraic(move.from)[0];
        }
        output += "x";
      }
      output += algebraic(move.to);
      if (move.promotion) {
        output += "=" + move.promotion.toUpperCase();
      }
    }
    this._makeMove(move);
    if (this.isCheck()) {
      if (this.isCheckmate()) {
        output += "#";
      } else {
        output += "+";
      }
    }
    this._undoMove();
    return output;
  }
  // convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
  _moveFromSan(move, strict = false) {
    let cleanMove = strippedSan(move);
    if (!strict) {
      if (cleanMove === "0-0") {
        cleanMove = "O-O";
      } else if (cleanMove === "0-0-0") {
        cleanMove = "O-O-O";
      }
    }
    if (cleanMove == SAN_NULLMOVE) {
      const res = {
        color: this._turn,
        from: 0,
        to: 0,
        piece: "k",
        flags: BITS.NULL_MOVE
      };
      return res;
    }
    let pieceType = inferPieceType(cleanMove);
    let moves = this._moves({ legal: true, piece: pieceType });
    for (let i = 0, len = moves.length; i < len; i++) {
      if (cleanMove === strippedSan(this._moveToSan(moves[i], moves))) {
        return moves[i];
      }
    }
    if (strict) {
      return null;
    }
    let piece = void 0;
    let matches = void 0;
    let from = void 0;
    let to = void 0;
    let promotion = void 0;
    let overlyDisambiguated = false;
    matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);
    if (matches) {
      piece = matches[1];
      from = matches[2];
      to = matches[3];
      promotion = matches[4];
      if (from.length == 1) {
        overlyDisambiguated = true;
      }
    } else {
      matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/);
      if (matches) {
        piece = matches[1];
        from = matches[2];
        to = matches[3];
        promotion = matches[4];
        if (from.length == 1) {
          overlyDisambiguated = true;
        }
      }
    }
    pieceType = inferPieceType(cleanMove);
    moves = this._moves({
      legal: true,
      piece: piece ? piece : pieceType
    });
    if (!to) {
      return null;
    }
    for (let i = 0, len = moves.length; i < len; i++) {
      if (!from) {
        if (cleanMove === strippedSan(this._moveToSan(moves[i], moves)).replace("x", "")) {
          return moves[i];
        }
      } else if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[from] == moves[i].from && Ox88[to] == moves[i].to && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
        return moves[i];
      } else if (overlyDisambiguated) {
        const square = algebraic(moves[i].from);
        if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[to] == moves[i].to && (from == square[0] || from == square[1]) && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
          return moves[i];
        }
      }
    }
    return null;
  }
  ascii() {
    let s = "   +------------------------+\n";
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      if (file(i) === 0) {
        s += " " + "87654321"[rank(i)] + " |";
      }
      if (this._board[i]) {
        const piece = this._board[i].type;
        const color = this._board[i].color;
        const symbol = color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
        s += " " + symbol + " ";
      } else {
        s += " . ";
      }
      if (i + 1 & 136) {
        s += "|\n";
        i += 8;
      }
    }
    s += "   +------------------------+\n";
    s += "     a  b  c  d  e  f  g  h";
    return s;
  }
  perft(depth) {
    const moves = this._moves({ legal: false });
    let nodes = 0;
    const color = this._turn;
    for (let i = 0, len = moves.length; i < len; i++) {
      this._makeMove(moves[i]);
      if (!this._isKingAttacked(color)) {
        if (depth - 1 > 0) {
          nodes += this.perft(depth - 1);
        } else {
          nodes++;
        }
      }
      this._undoMove();
    }
    return nodes;
  }
  setTurn(color) {
    if (this._turn == color) {
      return false;
    }
    this.move("--");
    return true;
  }
  turn() {
    return this._turn;
  }
  board() {
    const output = [];
    let row = [];
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      if (this._board[i] == null) {
        row.push(null);
      } else {
        row.push({
          square: algebraic(i),
          type: this._board[i].type,
          color: this._board[i].color
        });
      }
      if (i + 1 & 136) {
        output.push(row);
        row = [];
        i += 8;
      }
    }
    return output;
  }
  squareColor(square) {
    if (square in Ox88) {
      const sq = Ox88[square];
      return (rank(sq) + file(sq)) % 2 === 0 ? "light" : "dark";
    }
    return null;
  }
  history({ verbose = false } = {}) {
    const reversedHistory = [];
    const moveHistory = [];
    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove());
    }
    while (true) {
      const move = reversedHistory.pop();
      if (!move) {
        break;
      }
      if (verbose) {
        moveHistory.push(new Move(this, move));
      } else {
        moveHistory.push(this._moveToSan(move, this._moves()));
      }
      this._makeMove(move);
    }
    return moveHistory;
  }
  /*
   * Keeps track of position occurrence counts for the purpose of repetition
   * checking. Old positions are removed from the map if their counts are reduced to 0.
   */
  _getPositionCount(hash) {
    return this._positionCount.get(hash) ?? 0;
  }
  _incPositionCount() {
    this._positionCount.set(this._hash, (this._positionCount.get(this._hash) ?? 0) + 1);
  }
  _decPositionCount(hash) {
    const currentCount = this._positionCount.get(hash) ?? 0;
    if (currentCount === 1) {
      this._positionCount.delete(hash);
    } else {
      this._positionCount.set(hash, currentCount - 1);
    }
  }
  _pruneComments() {
    const reversedHistory = [];
    const currentComments = {};
    const copyComment = /* @__PURE__ */ __name((fen) => {
      if (fen in this._comments) {
        currentComments[fen] = this._comments[fen];
      }
    }, "copyComment");
    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove());
    }
    copyComment(this.fen());
    while (true) {
      const move = reversedHistory.pop();
      if (!move) {
        break;
      }
      this._makeMove(move);
      copyComment(this.fen());
    }
    this._comments = currentComments;
  }
  getComment() {
    return this._comments[this.fen()];
  }
  setComment(comment) {
    this._comments[this.fen()] = comment.replace("{", "[").replace("}", "]");
  }
  /**
   * @deprecated Renamed to `removeComment` for consistency
   */
  deleteComment() {
    return this.removeComment();
  }
  removeComment() {
    const comment = this._comments[this.fen()];
    delete this._comments[this.fen()];
    return comment;
  }
  getComments() {
    this._pruneComments();
    return Object.keys(this._comments).map((fen) => {
      return { fen, comment: this._comments[fen] };
    });
  }
  /**
   * @deprecated Renamed to `removeComments` for consistency
   */
  deleteComments() {
    return this.removeComments();
  }
  removeComments() {
    this._pruneComments();
    return Object.keys(this._comments).map((fen) => {
      const comment = this._comments[fen];
      delete this._comments[fen];
      return { fen, comment };
    });
  }
  setCastlingRights(color, rights) {
    for (const side of [KING, QUEEN]) {
      if (rights[side] !== void 0) {
        if (rights[side]) {
          this._castling[color] |= SIDES[side];
        } else {
          this._castling[color] &= ~SIDES[side];
        }
      }
    }
    this._updateCastlingRights();
    const result = this.getCastlingRights(color);
    return (rights[KING] === void 0 || rights[KING] === result[KING]) && (rights[QUEEN] === void 0 || rights[QUEEN] === result[QUEEN]);
  }
  getCastlingRights(color) {
    return {
      [KING]: (this._castling[color] & SIDES[KING]) !== 0,
      [QUEEN]: (this._castling[color] & SIDES[QUEEN]) !== 0
    };
  }
  moveNumber() {
    return this._moveNumber;
  }
};

// cloudflare/game-engines/chess-engine.js
function chessOf(state) {
  try {
    return new Chess(state && state.fen ? state.fen : void 0);
  } catch (_) {
    return null;
  }
}
__name(chessOf, "chessOf");
function chessFull(state) {
  const fen = state && state.fen ? state.fen : null;
  const hist = state && Array.isArray(state.history) ? state.history : [];
  if (!fen || !hist.length) return chessOf(state);
  try {
    const replay = new Chess();
    for (const h of hist) {
      if (!h || !h.from || !h.to) return chessOf(state);
      const r = h.promotion ? replay.move({ from: h.from, to: h.to, promotion: h.promotion }) : replay.move({ from: h.from, to: h.to });
      if (!r) return chessOf(state);
    }
    const probe = chessOf(state);
    return probe && replay.fen() === probe.fen() ? replay : probe;
  } catch (_) {
    return chessOf(state);
  }
}
__name(chessFull, "chessFull");
function boardFromChess(chess) {
  return chess.board().flatMap((row, rowIndex) => row.map((piece, file2) => piece ? { type: piece.type, color: piece.color === "w" ? "white" : "black", file: file2, rank: 7 - rowIndex } : null));
}
__name(boardFromChess, "boardFromChess");
function colorFor(state, userId) {
  return String(state.players && state.players[0]) === String(userId) ? "white" : String(state.players && state.players[1]) === String(userId) ? "black" : null;
}
__name(colorFor, "colorFor");
function sync(state, chess) {
  state.fen = chess.fen();
  state.board = boardFromChess(chess);
  state.turn = chess.turn() === "w" ? "white" : "black";
  state.moveCount = (state.history || []).length;
  state.updatedAt = /* @__PURE__ */ new Date();
}
__name(sync, "sync");
function createGame3(params = {}) {
  const chess = new Chess(), players = (params.playerIds || ["w", "b"]).map(String).slice(0, 2);
  return { engine: "chess", version: 3, status: "waiting", turn: "white", players, fen: chess.fen(), board: boardFromChess(chess), moveCount: 0, finished: false, winner: null, finishReason: "", history: [], createdAt: /* @__PURE__ */ new Date() };
}
__name(createGame3, "createGame");
function getPublicState3(state) {
  const chess = chessOf(state);
  if (!chess) return { engine: state.engine, version: state.version, status: state.status, turn: state.turn, players: state.players, finished: state.finished, winner: state.winner, finishReason: state.finishReason || "", board: state.board || [], moveHistory: state.history || [], moveCount: state.moveCount || 0, check: false, createdAt: state.createdAt };
  sync(state, chess);
  return { engine: state.engine, version: state.version, status: state.status, turn: state.turn, players: state.players, finished: state.finished, winner: state.winner, finishReason: state.finishReason || "", board: state.board, moveHistory: state.history || [], moveCount: state.moveCount || 0, check: chess.inCheck(), createdAt: state.createdAt };
}
__name(getPublicState3, "getPublicState");
function getPrivateState3(state, userId) {
  const myColor = colorFor(state, userId);
  return { myColor, turn: state.turn === myColor, canMove: state.turn === myColor && !state.finished };
}
__name(getPrivateState3, "getPrivateState");
function getLegalActions2(state, userId) {
  if (!["active", "waiting"].includes(state.status) || state.finished) return [];
  const myColor = colorFor(state, userId);
  if (!myColor || state.turn !== myColor) return [];
  const chess = chessOf(state);
  if (!chess) return [];
  return chess.moves({ verbose: true }).map((move) => ({ type: "move", from: move.from, to: move.to, promotion: move.promotion || null }));
}
__name(getLegalActions2, "getLegalActions");
function finishFromBoard(state, chess, movingColor) {
  if (chess.isCheckmate()) {
    state.finished = true;
    state.status = "finished";
    state.winner = movingColor;
    state.finishReason = "checkmate";
  } else if (chess.isStalemate()) {
    state.finished = true;
    state.status = "finished";
    state.winner = "draw";
    state.finishReason = "stalemate";
  } else if (chess.isInsufficientMaterial()) {
    state.finished = true;
    state.status = "finished";
    state.winner = "draw";
    state.finishReason = "insufficient_material";
  } else if (chess.isThreefoldRepetition()) {
    state.finished = true;
    state.status = "finished";
    state.winner = "draw";
    state.finishReason = "threefold_repetition";
  } else if (chess.isDrawByFiftyMoves()) {
    state.finished = true;
    state.status = "finished";
    state.winner = "draw";
    state.finishReason = "fifty_move_rule";
  }
}
__name(finishFromBoard, "finishFromBoard");
function applyAction3(state, userId, action = {}) {
  action = action && typeof action === "object" ? action : {};
  if (!["active", "waiting"].includes(state.status) || state.finished) return { error: "\u0627\u0644\u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0646\u0634\u0637\u0629" };
  const myColor = colorFor(state, userId);
  if (!myColor) return { error: "\u0623\u0646\u062A \u0644\u0633\u062A \u0644\u0627\u0639\u0628\u064B\u0627 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629" };
  if (action.type === "resign") {
    state.finished = true;
    state.status = "finished";
    state.winner = myColor === "white" ? "black" : "white";
    state.finishReason = "resignation";
    state.updatedAt = /* @__PURE__ */ new Date();
    return { ok: true, state };
  }
  if (state.turn !== myColor) return { error: "\u0644\u064A\u0633 \u062F\u0648\u0631\u0643" };
  if (action.type !== "move" || !action.from || !action.to) return { error: "\u062D\u0631\u0643\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629" };
  const chess = chessOf(state);
  if (!chess) return { error: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0634\u0637\u0631\u0646\u062C \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" };
  try {
    const result = chess.move({ from: action.from, to: action.to, promotion: action.promotion || "q" });
    if (!result) return { error: "\u0646\u0642\u0644\u0629 \u063A\u064A\u0631 \u0642\u0627\u0646\u0648\u0646\u064A\u0629" };
    state.history = Array.isArray(state.history) ? state.history : [];
    state.history.push({ from: result.from, to: result.to, piece: result.piece, color: result.color === "w" ? "white" : "black", captured: result.captured || null, promotion: result.promotion || null, san: result.san, flags: result.flags });
    sync(state, chess);
    state.status = state.status === "waiting" ? "active" : state.status;
    finishFromBoard(state, chessFull(state) || chess, myColor);
    return { ok: true, state };
  } catch (error3) {
    return { error: error3.message || "\u0646\u0642\u0644\u0629 \u063A\u064A\u0631 \u0642\u0627\u0646\u0648\u0646\u064A\u0629" };
  }
}
__name(applyAction3, "applyAction");
function isFinished3(state) {
  return !!state.finished;
}
__name(isFinished3, "isFinished");
function getWinner3(state) {
  return state.winner || null;
}
__name(getWinner3, "getWinner");
function serialize3(state) {
  const chess = chessOf(state);
  return JSON.stringify({ ...state, board: chess ? boardFromChess(chess) : state.board || [] });
}
__name(serialize3, "serialize");
var engine3 = { createGame: createGame3, getPublicState: getPublicState3, getPrivateState: getPrivateState3, getLegalActions: getLegalActions2, applyAction: applyAction3, isFinished: isFinished3, getWinner: getWinner3, serialize: serialize3 };
var chess_engine_default = engine3;

// cloudflare/game-engines/cards-engine.js
var SUITS = ["s", "h", "d", "c"];
var LABELS = { 1: "A", 11: "J", 12: "Q", 13: "K" };
function points(value) {
  return value > 10 ? 10 : value;
}
__name(points, "points");
function makeDeck() {
  const deck = [];
  for (const suit of SUITS) for (let value = 1; value <= 13; value++) deck.push({ id: suit + value, suit, value, rank: LABELS[value] || String(value), points: points(value) });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
__name(makeDeck, "makeDeck");
function normalize(state) {
  state.players = (state.players || []).map(String);
  state.hands = state.hands || {};
  state.melds = state.melds || [];
  state.scores = state.scores || {};
  state.phase = state.phase || "draw";
  state.stock = state.stock || [];
  state.discard = state.discard || [];
  return state;
}
__name(normalize, "normalize");
function createGame4(params = {}) {
  const players = (params.playerIds || ["p1", "p2"]).map(String).slice(0, 6), stock = makeDeck(), hands = {}, scores = {};
  players.forEach((id) => {
    hands[id] = [];
    scores[id] = 0;
  });
  for (let n = 0; n < 7; n++) players.forEach((id) => hands[id].push(stock.pop()));
  const discard = [stock.pop()];
  return { engine: "cards", version: 2, status: "waiting", players, turn: players[0], phase: "draw", hands, stock, discard, melds: [], scores, finished: false, winner: null, finishReason: "", moveCount: 0, createdAt: /* @__PURE__ */ new Date() };
}
__name(createGame4, "createGame");
function cardIds(cards) {
  return new Set((cards || []).map((card) => card.id));
}
__name(cardIds, "cardIds");
function selectedCards(state, userId, ids) {
  const wanted = new Set((ids || []).map(String)), cards = (state.hands[userId] || []).filter((card) => wanted.has(String(card.id)));
  return cards.length === wanted.size ? cards : null;
}
__name(selectedCards, "selectedCards");
function validMeld(cards) {
  if (!cards || cards.length < 3) return false;
  const sameRank = cards.every((card) => card.value === cards[0].value) && new Set(cards.map((card) => card.suit)).size === cards.length;
  const ordered = [...cards].sort((a, b) => a.value - b.value), sameSuit = ordered.every((card) => card.suit === ordered[0].suit);
  const sequence = sameSuit && ordered.every((card, index) => index === 0 || card.value === ordered[index - 1].value + 1);
  return sameRank || sequence;
}
__name(validMeld, "validMeld");
function nextTurn(state) {
  const index = state.players.indexOf(String(state.turn));
  state.turn = state.players[(index + 1) % state.players.length];
  state.phase = "draw";
}
__name(nextTurn, "nextTurn");
function finish(state, userId) {
  state.finished = true;
  state.status = "finished";
  state.winner = String(userId);
  state.finishReason = "empty_hand";
}
__name(finish, "finish");
function getPublicState4(state) {
  normalize(state);
  return { engine: state.engine, version: state.version, status: state.status, players: state.players.map((id) => ({ id, handCount: (state.hands[id] || []).length, score: Number(state.scores[id] || 0) })), turn: state.turn, phase: state.phase, stockCount: state.stock.length, discardTop: state.discard[state.discard.length - 1] || null, discardCount: state.discard.length, melds: state.melds, scores: state.scores, finished: state.finished, winner: state.winner, finishReason: state.finishReason, moveCount: state.moveCount || 0 };
}
__name(getPublicState4, "getPublicState");
function getPrivateState4(state, userId) {
  normalize(state);
  userId = String(userId);
  return { hand: state.hands[userId] || [], turn: state.turn === userId, phase: state.phase };
}
__name(getPrivateState4, "getPrivateState");
function getLegalActions3(state, userId) {
  normalize(state);
  userId = String(userId);
  if (!["active", "waiting"].includes(state.status) || state.finished || state.turn !== userId) return [];
  if (state.phase === "draw") {
    const out = [];
    if (state.stock.length) out.push({ type: "draw", source: "stock" });
    if (state.discard.length) out.push({ type: "draw", source: "discard" });
    return out;
  }
  return [{ type: "meld" }, { type: "discard" }];
}
__name(getLegalActions3, "getLegalActions");
function applyAction4(state, userId, action = {}) {
  action = action && typeof action === "object" ? action : {};
  normalize(state);
  userId = String(userId);
  if (!["active", "waiting"].includes(state.status) || state.finished) return { error: "\u0627\u0644\u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0646\u0634\u0637\u0629" };
  if (!state.players.includes(userId)) return { error: "\u0623\u0646\u062A \u0644\u0633\u062A \u0644\u0627\u0639\u0628\u064B\u0627" };
  if (state.turn !== userId) return { error: "\u0644\u064A\u0633 \u062F\u0648\u0631\u0643" };
  if (action.type === "draw") {
    if (state.phase !== "draw") return { error: "\u0644\u0642\u062F \u0633\u062D\u0628\u062A \u0648\u0631\u0642\u0629 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u062F\u0648\u0631" };
    let card;
    if (action.source === "discard") card = state.discard.pop();
    else card = state.stock.pop();
    if (!card) return { error: "\u0627\u0644\u0643\u0648\u0645\u0629 \u0641\u0627\u0631\u063A\u0629" };
    state.hands[userId].push(card);
    state.phase = "play";
    state.status = "active";
    state.moveCount += 1;
    return { ok: true, state };
  }
  if (state.phase !== "play") return { error: "\u0627\u0633\u062D\u0628 \u0648\u0631\u0642\u0629 \u0623\u0648\u0644\u064B\u0627" };
  if (action.type === "meld") {
    const cards = selectedCards(state, userId, action.cardIds);
    if (!validMeld(cards)) return { error: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" };
    const ids = cardIds(cards);
    state.hands[userId] = state.hands[userId].filter((card) => !ids.has(card.id));
    const earned = cards.reduce((sum, card) => sum + card.points, 0);
    state.scores[userId] = Number(state.scores[userId] || 0) + earned;
    state.melds.push({ playerId: userId, cards, points: earned });
    state.moveCount += 1;
    if (!state.hands[userId].length) finish(state, userId);
    return { ok: true, state };
  }
  if (action.type === "discard") {
    const index = state.hands[userId].findIndex((card) => String(card.id) === String(action.cardId));
    if (index < 0) return { error: "\u0627\u0644\u0648\u0631\u0642\u0629 \u0644\u064A\u0633\u062A \u0641\u064A \u064A\u062F\u0643" };
    state.discard.push(state.hands[userId].splice(index, 1)[0]);
    state.moveCount += 1;
    if (!state.hands[userId].length) finish(state, userId);
    else nextTurn(state);
    return { ok: true, state };
  }
  return { error: "\u062D\u0631\u0643\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629" };
}
__name(applyAction4, "applyAction");
function isFinished4(state) {
  return !!state.finished;
}
__name(isFinished4, "isFinished");
function getWinner4(state) {
  return state.winner || null;
}
__name(getWinner4, "getWinner");
function serialize4(state) {
  normalize(state);
  return JSON.stringify(state);
}
__name(serialize4, "serialize");
var engine4 = { createGame: createGame4, getPublicState: getPublicState4, getPrivateState: getPrivateState4, getLegalActions: getLegalActions3, applyAction: applyAction4, isFinished: isFinished4, getWinner: getWinner4, serialize: serialize4, validMeld };
var cards_engine_default = engine4;

// cloudflare/kahwa-engine.js
var engines = { domino: domino_engine_default, tawla: tawla_engine_default, chess: chess_engine_default, cards: cards_engine_default };
function engineFor(type) {
  if (!Object.hasOwn(engines, type)) throw new Error("Unsupported game engine");
  return engines[type];
}
__name(engineFor, "engineFor");
function freshGame(type, ids) {
  const engine5 = engineFor(type);
  const state = engine5.createGame({ playerIds: ids, players: ids.length });
  state.status = "active";
  return state;
}
__name(freshGame, "freshGame");
function publicGame(type, state, userId) {
  const engine5 = engineFor(type), copy = structuredClone(state);
  const visible = engine5.getPublicState(copy) || {};
  const privateState = userId && engine5.getPrivateState ? engine5.getPrivateState(structuredClone(state), String(userId)) : null;
  const legalActions2 = userId && engine5.getLegalActions ? engine5.getLegalActions(structuredClone(state), String(userId)) : [];
  return { public: visible, private: privateState, legalActions: legalActions2 };
}
__name(publicGame, "publicGame");
function moveGame(type, oldState, userId, action) {
  const engine5 = engineFor(type);
  const moveId = String(action?.moveId || "").slice(0, 80);
  const state = structuredClone(oldState);
  const prior = Array.isArray(state.appliedMoveIds) ? state.appliedMoveIds : [];
  if (moveId && prior.includes(moveId)) return { ok: true, duplicate: true, state };
  const result = engine5.applyAction(state, String(userId), action);
  if (!result || result.error || result.ok === false) return { ok: false, error: result?.error || "\u062D\u0631\u0643\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" };
  const next = result.state || state;
  if (moveId) {
    const ids = Array.isArray(next.appliedMoveIds) ? next.appliedMoveIds : [];
    ids.push(moveId);
    next.appliedMoveIds = ids.slice(-50);
  }
  return { ok: true, duplicate: false, state: next };
}
__name(moveGame, "moveGame");

// cloudflare/kahwa-rooms.js
var TYPES = { domino: ["\u062F\u0648\u0645\u0646\u0629", "\u{1F06B}"], tawla: ["\u0637\u0627\u0648\u0644\u064A", "\u{1F3B2}"], cards: ["\u0648\u0631\u0642", "\u{1F0CF}"], chess: ["\u0634\u0637\u0631\u0646\u062C", "\u265F"] };
var json = /* @__PURE__ */ __name((data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } }), "json");
var bad = /* @__PURE__ */ __name((message, status = 400) => json({ ok: false, message }, status), "bad");
var clean = /* @__PURE__ */ __name((value) => String(value ?? "").trim(), "clean");
var profile3 = /* @__PURE__ */ __name((row) => ({ id: row.id, name: row.full_name || row.username || "\u0644\u0627\u0639\u0628", username: row.username || "" }), "profile");
async function prepare(db, row, viewerId = null) {
  const members = await db.prepare("SELECT u.id,u.full_name,u.username,p.seat_index FROM game_room_players p JOIN users u ON u.id=p.user_id WHERE p.room_id=? ORDER BY p.seat_index").bind(row.id).all();
  const players = members.results.map(profile3);
  const owner = players.find((p) => p.id === row.owner_id) || { id: row.owner_id, name: "\u0627\u0644\u0645\u0627\u0644\u0643" };
  const stored = await db.prepare("SELECT state_json,version FROM game_room_state WHERE room_id=?").bind(row.id).first();
  const state = stored ? JSON.parse(stored.state_json) : null;
  const engine5 = state ? publicGame(row.game_type, state, players.some((p) => p.id === viewerId) ? viewerId : null) : null;
  const gameState = { status: state?.status || row.status, turn: state?.turn ? players.find((p) => p.id === state.turn) || state.turn : null, teamScores: state?.teamScores || { A: 0, B: 0 }, ...engine5?.public || {} };
  return { id: row.id, roomCode: row.room_code, name: row.name, gameType: row.game_type, gameName: TYPES[row.game_type][0], gameIcon: TYPES[row.game_type][1], visibility: row.visibility, maxPlayers: row.max_players, teamMode: row.team_mode, owner, players, reservations: [], spectators: [], isActive: !!row.is_active, gameState, engineState: engine5 || void 0 };
}
__name(prepare, "prepare");
async function canSee(db, row, user) {
  if (row.visibility === "public" || row.owner_id === user.id) return true;
  const member = await db.prepare("SELECT 1 AS present FROM game_room_players WHERE room_id=? AND user_id=?").bind(row.id, user.id).first();
  if (member) return true;
  if (row.visibility !== "friends") return false;
  const friend = await db.prepare("SELECT 1 AS present FROM friend_requests WHERE status='accepted' AND ((sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)) LIMIT 1").bind(user.id, row.owner_id, row.owner_id, user.id).first();
  return !!friend;
}
__name(canSee, "canSee");
function permitted(req) {
  const origin = req.headers.get("Origin");
  if (origin && origin !== new URL(req.url).origin) return false;
  return req.headers.get("Sec-Fetch-Site") !== "cross-site";
}
__name(permitted, "permitted");
async function handleGameRooms(req, env2, user) {
  const path = new URL(req.url).pathname;
  const sub = path.replace(/^\/api\/game-rooms\/?/, "").split("/").filter(Boolean);
  const db = env2.DB, method = req.method;
  if (!["GET", "HEAD"].includes(method) && !permitted(req)) return bad("\u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062B\u0648\u0642", 403);
  if (sub.length === 0 && method === "GET") {
    const type = new URL(req.url).searchParams.get("gameType");
    if (type && !TYPES[type]) return bad("\u0646\u0648\u0639 \u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
    const q = type ? db.prepare("SELECT * FROM game_rooms WHERE is_active=1 AND game_type=? ORDER BY updated_at DESC LIMIT 100").bind(type) : db.prepare("SELECT * FROM game_rooms WHERE is_active=1 ORDER BY updated_at DESC LIMIT 100");
    const rows = (await q.all()).results;
    const visible = [];
    for (const row2 of rows) if (await canSee(db, row2, user)) visible.push(await prepare(db, row2));
    return json({ ok: true, rooms: visible, maxListed: 100, gameTypes: Object.entries(TYPES).map(([id, [name, icon]]) => ({ id, name, icon })) });
  }
  if (sub.length === 0 && method === "DELETE") {
    const result = await db.prepare("UPDATE game_rooms SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE owner_id=? AND is_active=1").bind(user.id).run();
    return json({ ok: true, message: "\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u063A\u0631\u0641 \u0627\u0644\u062A\u064A \u062A\u0645\u0644\u0643\u0647\u0627", closed: Number(result.meta?.changes || 0) });
  }
  if (sub.length === 0 && method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return bad("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0627\u0648\u0644\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629");
    const type = clean(body.gameType), visibility = clean(body.visibility) || "public";
    if (!TYPES[type] || !["public", "friends", "private"].includes(visibility)) return bad("\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    const max = Number(body.maxPlayers || (type === "cards" ? 4 : 2));
    if (!Number.isInteger(max) || !(type === "cards" ? [2, 3, 4, 5, 6].includes(max) : type === "domino" ? [2, 4].includes(max) : max === 2)) return bad("\u0639\u062F\u062F \u0627\u0644\u0644\u0627\u0639\u0628\u064A\u0646 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
    const teamMode = clean(body.teamMode) === "2v2" ? "2v2" : "solo";
    if (teamMode === "2v2" && (max !== 4 || !["domino", "cards"].includes(type))) return bad("\u0627\u0644\u0641\u0650\u0631\u0642 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u0644\u0639\u0628\u0629");
    const name = clean(body.name) || "\u0637\u0627\u0648\u0644\u0629 " + TYPES[type][0];
    if (name.length > 100) return bad("\u0627\u0633\u0645 \u0627\u0644\u063A\u0631\u0641\u0629 \u0637\u0648\u064A\u0644");
    const id = crypto.randomUUID(), code = String(1e5 + Math.floor(Math.random() * 9e5));
    try {
      await db.batch([
        db.prepare("INSERT INTO game_rooms(id,room_code,owner_id,name,game_type,visibility,max_players,team_mode) VALUES(?,?,?,?,?,?,?,?)").bind(id, code, user.id, name, type, visibility, max, teamMode),
        db.prepare("INSERT INTO game_room_players(room_id,user_id,seat_index) VALUES(?,?,0)").bind(id, user.id)
      ]);
    } catch (e) {
      return bad("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u063A\u0631\u0641\u0629. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.", 503);
    }
    const row2 = await db.prepare("SELECT * FROM game_rooms WHERE id=?").bind(id).first();
    return json({ ok: true, room: await prepare(db, row2) }, 201);
  }
  const roomId = sub[0];
  if (!roomId || !/^[-0-9a-f]{36}$/i.test(roomId)) return bad("\u0627\u0644\u063A\u0631\u0641\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const row = await db.prepare("SELECT * FROM game_rooms WHERE id=? AND is_active=1").bind(roomId).first();
  if (!row) return bad("\u0627\u0644\u063A\u0631\u0641\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const allowed = await canSee(db, row, user);
  if (sub.length === 1 && method === "GET") {
    if (!allowed) return bad("\u0627\u0644\u063A\u0631\u0641\u0629 \u062E\u0627\u0635\u0629", 403);
    return json({ ok: true, viewerId: user.id, room: await prepare(db, row, user.id) });
  }
  if (sub.length === 1 && method === "DELETE") {
    if (row.owner_id !== user.id) return bad("\u062D\u0630\u0641 \u0627\u0644\u063A\u0631\u0641\u0629 \u0645\u062A\u0627\u062D \u0644\u0644\u0645\u0627\u0644\u0643 \u0641\u0642\u0637", 403);
    await db.prepare("UPDATE game_rooms SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?").bind(roomId, user.id).run();
    return json({ ok: true, message: "\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u063A\u0631\u0641\u0629" });
  }
  if (sub.length === 2 && sub[1] === "join" && method === "POST") {
    if (!allowed) return bad("\u0627\u0644\u063A\u0631\u0641\u0629 \u062E\u0627\u0635\u0629 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645", 403);
    if (row.status !== "waiting") return bad("\u0627\u0644\u0644\u0639\u0628\u0629 \u0628\u062F\u0623\u062A \u0628\u0627\u0644\u0641\u0639\u0644", 409);
    const old = await db.prepare("SELECT 1 FROM game_room_players WHERE room_id=? AND user_id=?").bind(roomId, user.id).first();
    if (!old) {
      const members = await db.prepare("SELECT seat_index FROM game_room_players WHERE room_id=? ORDER BY seat_index").bind(roomId).all();
      const used = new Set(members.results.map((r) => r.seat_index));
      let seat = 0;
      while (used.has(seat) && seat < row.max_players) seat++;
      if (seat >= row.max_players) return bad("\u0627\u0644\u0637\u0627\u0648\u0644\u0629 \u0645\u0645\u062A\u0644\u0626\u0629", 409);
      try {
        await db.prepare("INSERT INTO game_room_players(room_id,user_id,seat_index) VALUES(?,?,?)").bind(roomId, user.id, seat).run();
      } catch {
        return bad("\u062D\u0627\u0648\u0644 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0645\u062C\u062F\u062F\u064B\u0627", 409);
      }
    }
    return json({ ok: true, room: await prepare(db, row, user.id) });
  }
  if (sub.length === 2 && sub[1] === "join" && method === "DELETE") {
    if (row.owner_id === user.id) return bad("\u0645\u0627\u0644\u0643 \u0627\u0644\u0637\u0627\u0648\u0644\u0629 \u064A\u063A\u0644\u0642\u0647\u0627 \u0628\u062F\u0644 \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629", 403);
    if (row.status !== "waiting") return bad("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u0645\u063A\u0627\u062F\u0631\u0629 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629", 409);
    await db.prepare("DELETE FROM game_room_players WHERE room_id=? AND user_id=?").bind(roomId, user.id).run();
    return json({ ok: true });
  }
  if (sub.length === 2 && sub[1] === "start" && method === "POST") {
    if (row.owner_id !== user.id) return bad("\u0645\u0627\u0644\u0643 \u0627\u0644\u0637\u0627\u0648\u0644\u0629 \u0641\u0642\u0637 \u064A\u0628\u062F\u0623 \u0627\u0644\u0644\u0639\u0628\u0629", 403);
    if (row.status !== "waiting") return bad("\u0627\u0644\u0644\u0639\u0628\u0629 \u0628\u062F\u0623\u062A \u0628\u0627\u0644\u0641\u0639\u0644", 409);
    const players = (await db.prepare("SELECT user_id FROM game_room_players WHERE room_id=? ORDER BY seat_index").bind(roomId).all()).results.map((p) => p.user_id);
    if (players.length !== row.max_players) return bad("\u064A\u062C\u0628 \u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u0644\u0627\u0639\u0628\u064A\u0646 \u0642\u0628\u0644 \u0628\u062F\u0621 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629", 409);
    const game = freshGame(row.game_type, players);
    game.teamScores = { A: 0, B: 0 };
    try {
      const inserted = await db.prepare("INSERT INTO game_room_state(room_id,state_json,version) SELECT id,?,0 FROM game_rooms WHERE id=? AND is_active=1 AND status='waiting' AND NOT EXISTS(SELECT 1 FROM game_room_state WHERE room_id=?)").bind(JSON.stringify(game), roomId, roomId).run();
      if (!inserted.meta?.changes) return bad("\u062A\u0645 \u0628\u062F\u0621 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649", 409);
      const updated = await db.prepare("UPDATE game_rooms SET status='active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='waiting' AND is_active=1").bind(roomId).run();
      if (!updated.meta?.changes) return bad("\u062A\u0639\u0630\u0631 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629", 409);
      return json({ ok: true, room: await prepare(db, { ...row, status: "active" }, user.id) });
    } catch {
      return bad("\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629", 503);
    }
  }
  if (sub.length === 2 && sub[1] === "action" && method === "POST") {
    if (row.status !== "active") return bad("\u0627\u0644\u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0646\u0634\u0637\u0629", 409);
    const member = await db.prepare("SELECT 1 AS present FROM game_room_players WHERE room_id=? AND user_id=?").bind(roomId, user.id).first();
    if (!member) return bad("\u0647\u0630\u0647 \u0627\u0644\u062D\u0631\u0643\u0629 \u0644\u0644\u0627\u0639\u0628\u064A\u0646 \u0641\u0642\u0637", 403);
    const action = await req.json().catch(() => null);
    if (!action || typeof action !== "object" || Array.isArray(action) || JSON.stringify(action).length > 4096) return bad("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0631\u0643\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", 400);
    const latest = await db.prepare("SELECT state_json,version FROM game_room_state WHERE room_id=?").bind(roomId).first();
    if (!latest) return bad("\u062D\u0627\u0644\u0629 \u0627\u0644\u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 503);
    const result = moveGame(row.game_type, JSON.parse(latest.state_json), user.id, action);
    if (!result.ok) return bad(result.error || "\u0627\u0644\u062D\u0631\u0643\u0629 \u063A\u064A\u0631 \u0642\u0627\u0646\u0648\u0646\u064A\u0629", 400);
    if (!result.duplicate) {
      const updated = await db.prepare("UPDATE game_room_state SET state_json=?,version=version+1,saved_at=CURRENT_TIMESTAMP WHERE room_id=? AND version=?").bind(JSON.stringify(result.state), roomId, latest.version).run();
      if (!updated.meta?.changes) return bad("\u062A\u063A\u064A\u0631\u062A \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0627\u0648\u0644\u0629. \u062D\u062F\u0651\u062B \u0627\u0644\u0635\u0641\u062D\u0629 \u0648\u0623\u0639\u062F \u0627\u0644\u062D\u0631\u0643\u0629", 409);
      if (result.state.status === "finished") await db.prepare("UPDATE game_rooms SET status='finished',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'").bind(roomId).run();
    }
    const updatedRow = { ...row, status: result.state.status };
    return json({ ok: true, duplicate: result.duplicate, room: await prepare(db, updatedRow, user.id) });
  }
  return bad("\u062E\u062F\u0645\u0629 \u0627\u0644\u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0628\u0639\u062F", 501);
}
__name(handleGameRooms, "handleGameRooms");

// cloudflare/kahwa-actions.js
var response = /* @__PURE__ */ __name((data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } }), "response");
async function handleGameActions(req, env2, user) {
  const pathname = new URL(req.url).pathname;
  const found = pathname.match(/^\/api\/game-actions\/([0-9a-f-]{36})\/(state|match-settings|score|save|players|request-player)$/i);
  if (!found) return response({ ok: false, message: "\u0627\u0644\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" }, 404);
  const [, roomId, operation] = found;
  const room = await env2.DB.prepare("SELECT * FROM game_rooms WHERE id=? AND is_active=1").bind(roomId).first();
  if (!room) return response({ ok: false, message: "\u0627\u0644\u063A\u0631\u0641\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" }, 404);
  const player = await env2.DB.prepare("SELECT 1 AS present FROM game_room_players WHERE room_id=? AND user_id=?").bind(roomId, user.id).first();
  if (!player) return response({ ok: false, message: "\u0627\u0644\u0644\u0627\u0639\u0628\u0648\u0646 \u0641\u0642\u0637 \u064A\u0633\u062A\u0637\u064A\u0639\u0648\u0646 \u0627\u0633\u062A\u0639\u0645\u0627\u0644 \u0647\u0630\u0647 \u0627\u0644\u062E\u062F\u0645\u0629" }, 403);
  if (operation === "state" && req.method === "GET") return response({ ok: true, teamMode: room.team_mode, scoreTarget: 100, teamScores: { A: 0, B: 0 }, savedAt: null });
  const origin = req.headers.get("Origin");
  if (origin && origin !== new URL(req.url).origin) return response({ ok: false, message: "\u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062B\u0648\u0642" }, 403);
  if (operation === "match-settings" && req.method === "PATCH") {
    if (room.owner_id !== user.id) return response({ ok: false, message: "\u0645\u0627\u0644\u0643 \u0627\u0644\u063A\u0631\u0641\u0629 \u0641\u0642\u0637" }, 403);
    const body = await req.json().catch(() => ({}));
    const mode = body.teamMode || room.team_mode;
    if (mode !== room.team_mode || body.scoreTarget !== void 0 && Number(body.scoreTarget) !== 100) return response({ ok: false, message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0647\u0630\u0647 \u0627\u0644\u0637\u0627\u0648\u0644\u0629 \u0628\u0639\u062F \u0625\u0646\u0634\u0627\u0626\u0647\u0627" }, 409);
    return response({ ok: true, teamMode: room.team_mode, maxPlayers: room.max_players, scoreTarget: 100 });
  }
  if (operation === "score" && req.method === "POST") {
    if (room.owner_id !== user.id) return response({ ok: false, message: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0637\u0627\u0648\u0644\u0629 \u0641\u0642\u0637 \u064A\u0639\u062F\u0644 \u0627\u0644\u0646\u0642\u0627\u0637" }, 403);
    const body = await req.json().catch(() => null);
    if (!body || !["A", "B"].includes(body.team) || !Number.isSafeInteger(Number(body.delta)) || Math.abs(Number(body.delta)) > 999) return response({ ok: false, message: "\u0627\u0644\u0646\u0642\u0627\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" }, 400);
    const stored = await env2.DB.prepare("SELECT state_json,version FROM game_room_state WHERE room_id=?").bind(roomId).first();
    if (!stored) return response({ ok: false, message: "\u0644\u0645 \u062A\u0628\u062F\u0623 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629 \u0628\u0639\u062F" }, 409);
    const state = JSON.parse(stored.state_json);
    const scores = state.teamScores || { A: 0, B: 0 };
    scores[body.team] = Math.max(0, Number(scores[body.team] || 0) + Number(body.delta));
    state.teamScores = scores;
    const updated = await env2.DB.prepare("UPDATE game_room_state SET state_json=?,version=version+1,saved_at=CURRENT_TIMESTAMP WHERE room_id=? AND version=?").bind(JSON.stringify(state), roomId, stored.version).run();
    if (!updated.meta?.changes) return response({ ok: false, message: "\u062A\u063A\u064A\u0651\u0631\u062A \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0627\u0648\u0644\u0629. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629" }, 409);
    return response({ ok: true, teamScores: scores });
  }
  if (operation === "save" && req.method === "POST") {
    const state = await env2.DB.prepare("SELECT saved_at FROM game_room_state WHERE room_id=?").bind(roomId).first();
    if (!state) return response({ ok: false, message: "\u0644\u0645 \u062A\u0628\u062F\u0623 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629 \u0628\u0639\u062F" }, 409);
    return response({ ok: true, savedAt: state.saved_at, message: "\u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629 \u0645\u062D\u0641\u0648\u0638\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627" });
  }
  return response({ ok: false, message: "\u0647\u0630\u0647 \u0627\u0644\u0648\u0638\u064A\u0641\u0629 \u0642\u064A\u062F \u0627\u0644\u0646\u0642\u0644 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0646\u0641\u064A\u0630\u0647\u0627 \u0628\u0623\u0645\u0627\u0646 \u0628\u0639\u062F" }, 501);
}
__name(handleGameActions, "handleGameActions");

// cloudflare/kahwa-edge.js
var SESSION_COOKIE = "__Host-shino_session";
var reply = /* @__PURE__ */ __name((status, message) => Response.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }), "reply");
function rawCookie(req) {
  const item = (req.headers.get("Cookie") || "").split(";").map((x) => x.trim()).find((x) => x.startsWith(SESSION_COOKIE + "="));
  return item ? item.slice(SESSION_COOKIE.length + 1) : "";
}
__name(rawCookie, "rawCookie");
async function sessionUser(req, db) {
  const raw = rawCookie(req);
  if (!raw || raw.length > 512) return null;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return db.prepare("SELECT u.id,u.username,u.full_name,u.role,u.status FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.secret_hash=? AND s.revoked_at IS NULL AND s.expires_at>datetime('now') AND u.status='active'").bind(hash).first();
}
__name(sessionUser, "sessionUser");
var kahwa_edge_default = {
  async fetch(req, env2) {
    const path = new URL(req.url).pathname;
    if (!env2.DB) return reply(503, "\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0644\u0639\u0627\u0628 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629");
    if (req.method === "OPTIONS") return reply(405, "\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D");
    if (req.headers.get("Sec-Fetch-Site") === "cross-site") return reply(403, "\u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062B\u0648\u0642");
    const user = await sessionUser(req, env2.DB).catch(() => null);
    if (!user) return reply(401, "\u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644");
    try {
      if (path === "/api/game-rooms" || path.startsWith("/api/game-rooms/")) return await handleGameRooms(req, env2, user);
      if (path.startsWith("/api/game-actions/")) return await handleGameActions(req, env2, user);
      return reply(404, "\u0645\u0633\u0627\u0631 \u0627\u0644\u0644\u0639\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    } catch (error3) {
      console.error("Azawi gameplay error:", error3?.message || "unknown");
      return reply(503, "\u062A\u0639\u0630\u0631 \u062A\u0634\u063A\u064A\u0644 \u062E\u062F\u0645\u0629 \u0627\u0644\u0623\u0644\u0639\u0627\u0628");
    }
  }
};
export {
  kahwa_edge_default as default
};
/*! Bundled license information:

chess.js/dist/esm/chess.js:
  (**
   * @license
   * Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice,
   *    this list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the documentation
   *    and/or other materials provided with the distribution.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
   *)
*/
//# sourceMappingURL=kahwa-edge.js.map
