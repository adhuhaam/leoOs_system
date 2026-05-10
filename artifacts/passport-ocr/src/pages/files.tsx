import { useMemo, useState } from "react";
import { useSearch, useLocation } from "wouter";
import {
  getListFilesQueryKey,
  getGetFileItemQueryKey,
  useGetFilesStatus,
  useListFiles,
  useGetFileItem,
  type FileItem,
  type FileDetail,
} from "@workspace/api-client-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File as FileIcon,
  Download,
  ExternalLink,
  Search,
  Loader2,
  AlertTriangle,
  ChevronRight,
  HardDrive,
  RefreshCw,
  Eye,
  ArrowUpDown,
} from "lucide-react";

function bytesToHuman(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toUpperCase() : "";
}

function iconFor(item: FileItem) {
  if (item.isFolder) return Folder;
  const ext = extOf(item.name).toLowerCase();
  const mime = item.mimeType ?? "";
  if (mime.startsWith("image/") || ["jpg","jpeg","png","gif","webp","bmp","heic","heif"].includes(ext)) return FileImage;
  if (mime.startsWith("video/") || ["mp4","mov","webm","mkv"].includes(ext)) return FileVideo;
  if (mime.startsWith("audio/") || ["mp3","wav","m4a","ogg"].includes(ext)) return FileAudio;
  if (mime === "application/pdf" || ["pdf","docx","xlsx","pptx","doc","xls","ppt","txt","md","csv"].includes(ext)) return FileText;
  return FileIcon;
}

function previewUrl(path: string): string {
  return `/api/files/preview?path=${encodeURIComponent(path)}`;
}
function downloadUrl(path: string): string {
  return `/api/files/download?path=${encodeURIComponent(path)}`;
}
function thumbUrl(path: string, size: "small" | "medium" | "large" = "medium"): string {
  return `/api/files/thumbnail?path=${encodeURIComponent(path)}&size=${size}`;
}

type ViewMode = "grid" | "list";
type SortMode = "name" | "modified" | "size";
type SortDir = "asc" | "desc";

export default function FilesPage() {
  // URL-driven path: ?path=Foo/Bar — survives refresh, back/forward, and sharing.
  const searchStr = useSearch();
  const [, setLocation] = useLocation();
  const path = useMemo(() => {
    const params = new URLSearchParams(searchStr);
    return params.get("path") ?? "";
  }, [searchStr]);
  function setPath(next: string) {
    const params = new URLSearchParams();
    if (next) params.set("path", next);
    const qs = params.toString();
    setLocation("/files" + (qs ? `?${qs}` : ""));
  }

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortMode>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);

  const { data: status, isLoading: statusLoading } = useGetFilesStatus();
  const params = path ? { path } : undefined;
  const {
    data,
    isLoading,
    isFetching,
    refetch,
    error,
  } = useListFiles(params, {
    query: {
      enabled: !!status?.connected,
      queryKey: getListFilesQueryKey(params),
      staleTime: 60_000,
    },
  });

  const items = data?.items ?? [];
  const breadcrumbs = data?.breadcrumbs ?? [{ name: "Files", path: "" }];

  const visible = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    const folders = list.filter((i) => i.isFolder);
    const files = list.filter((i) => !i.isFolder);
    const dir = sortDir === "asc" ? 1 : -1;
    const sortFn = (a: FileItem, b: FileItem) => {
      if (sort === "name") return a.name.localeCompare(b.name) * dir;
      if (sort === "modified") return a.lastModifiedAt.localeCompare(b.lastModifiedAt) * dir;
      return ((a.size ?? 0) - (b.size ?? 0)) * dir;
    };
    folders.sort(sortFn);
    files.sort(sortFn);
    return [...folders, ...files];
  }, [items, search, sort, sortDir]);

  const folderCount = items.filter((i) => i.isFolder).length;
  const fileCount = items.length - folderCount;
  const totalBytes = items.reduce((s, i) => s + (i.size ?? 0), 0);

  // ── Connection / loading states ────────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Checking OneDrive…
      </div>
    );
  }
  if (!status?.connected) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">OneDrive isn't connected</h2>
              <p className="text-sm text-muted-foreground">
                Connect the OneDrive account to browse files in the <code>data</code> folder.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask an administrator to sign in to OneDrive from the Replit Integrations panel.
              Once connected, refresh this page.
            </p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5 mr-2" /> Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
            <HardDrive className="h-3 w-3" /> OneDrive · data
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">Files</h1>
          <p className="text-sm text-muted-foreground">
            Browse, preview, and download documents stored in the shared OneDrive folder.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter in this folder…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[220px]"
              data-testid="input-files-search"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSort((s) => (s === "name" ? "modified" : s === "modified" ? "size" : "name"))
            }
            data-testid="button-files-sort"
            title="Change sort field"
          >
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            {sort === "name" ? "Name" : sort === "modified" ? "Modified" : "Size"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            data-testid="button-files-sort-dir"
            title="Toggle ascending / descending"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </Button>
          <div className="hidden sm:flex rounded-md border border-border overflow-hidden">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setView("grid")}
              data-testid="button-view-grid"
            >
              Grid
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setView("list")}
              data-testid="button-view-list"
            >
              List
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} data-testid="button-files-refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Breadcrumbs + counters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((b, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <span key={b.path || "_root"} className="inline-flex items-center">
                  <BreadcrumbItem>
                    {last ? (
                      <BreadcrumbPage className="font-semibold">{b.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button
                          onClick={() => setPath(b.path)}
                          className="hover:text-foreground"
                          data-testid={`crumb-${b.path || "root"}`}
                        >
                          {b.name}
                        </button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator />}
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-3">
          {!isLoading && (
            <div className="text-xs text-muted-foreground">
              {folderCount} folder{folderCount === 1 ? "" : "s"} · {fileCount} file
              {fileCount === 1 ? "" : "s"} · {bytesToHuman(totalBytes)}
            </div>
          )}
          <CurrentFolderOneDriveLink path={path} />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading folder…
        </div>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">
          Could not load this folder. <button className="underline" onClick={() => refetch()}>Try again</button>.
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
            <Folder className="h-10 w-10 opacity-40" />
            <p className="text-sm">{search ? "Nothing matches your filter." : "This folder is empty."}</p>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {visible.map((item) => (
            <FileTile
              key={item.id}
              item={item}
              onOpenFolder={() => setPath(item.path)}
              onPreview={() => setPreviewItem(item)}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_180px_120px] px-4 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <div>Name</div>
            <div className="text-right">Size</div>
            <div className="text-right">Modified</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="divide-y divide-border">
            {visible.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                onOpenFolder={() => setPath(item.path)}
                onPreview={() => setPreviewItem(item)}
              />
            ))}
          </div>
        </Card>
      )}

      <PreviewDialog
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </div>
  );
}

// ── Current-folder "Open in OneDrive" link ───────────────────────────────
function CurrentFolderOneDriveLink({ path }: { path: string }) {
  const { data: detail } = useGetFileItem(
    { path },
    {
      query: {
        enabled: !!path,
        queryKey: getGetFileItemQueryKey({ path }),
        staleTime: 5 * 60_000,
      },
    },
  );
  if (!detail?.webUrl) return null;
  return (
    <a href={detail.webUrl} target="_blank" rel="noreferrer">
      <Button variant="ghost" size="sm" data-testid="button-open-folder-onedrive">
        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in OneDrive
      </Button>
    </a>
  );
}

// ── Tile (grid view) ─────────────────────────────────────────────────────
function FileTile({
  item,
  onOpenFolder,
  onPreview,
}: {
  item: FileItem;
  onOpenFolder: () => void;
  onPreview: () => void;
}) {
  const Icon = iconFor(item);
  const ext = extOf(item.name);
  const showThumb =
    !item.isFolder &&
    (item.mimeType?.startsWith("image/") ||
      item.mimeType === "application/pdf" ||
      ["jpg","jpeg","png","gif","webp","heic","heif","pdf"].includes(ext.toLowerCase()));

  return (
    <button
      onClick={item.isFolder ? onOpenFolder : onPreview}
      className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition overflow-hidden flex flex-col"
      data-testid={`tile-${item.isFolder ? "folder" : "file"}-${item.name}`}
    >
      <div className="aspect-[4/3] bg-muted/50 flex items-center justify-center relative">
        {showThumb ? (
          <img
            src={thumbUrl(item.path, "medium")}
            alt={item.name}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        {!showThumb && (
          <Icon
            className={`h-10 w-10 ${
              item.isFolder ? "text-amber-500" : "text-muted-foreground"
            }`}
          />
        )}
        {ext && !item.isFolder && (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur text-[10px] font-mono font-semibold text-muted-foreground">
            {ext}
          </span>
        )}
      </div>
      <div className="p-2.5 min-w-0">
        <div className="text-[13px] font-medium truncate" title={item.name}>
          {item.name}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {item.isFolder ? (
            <>
              <Folder className="h-3 w-3" /> Folder
            </>
          ) : (
            <>{bytesToHuman(item.size)}</>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Row (list view) ──────────────────────────────────────────────────────
function FileRow({
  item,
  onOpenFolder,
  onPreview,
}: {
  item: FileItem;
  onOpenFolder: () => void;
  onPreview: () => void;
}) {
  const Icon = iconFor(item);
  return (
    <div
      className="grid grid-cols-[1fr_120px_180px_120px] items-center px-4 py-2.5 hover:bg-muted/40 transition group"
    >
      <button
        className="flex items-center gap-3 min-w-0 text-left"
        onClick={item.isFolder ? onOpenFolder : onPreview}
        data-testid={`row-${item.name}`}
      >
        <div
          className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${
            item.isFolder ? "bg-amber-100 text-amber-600" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium truncate group-hover:text-foreground">
          {item.name}
        </span>
        {item.isFolder && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      <div className="text-right text-xs text-muted-foreground tabular-nums">
        {item.isFolder ? "—" : bytesToHuman(item.size)}
      </div>
      <div className="text-right text-xs text-muted-foreground">
        {formatDate(item.lastModifiedAt)}
      </div>
      <div className="flex items-center justify-end gap-1">
        {!item.isFolder && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPreview}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <a href={downloadUrl(item.path)} download>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// ── Preview dialog ──────────────────────────────────────────────────────
function PreviewDialog({
  item,
  onClose,
}: {
  item: FileItem | null;
  onClose: () => void;
}) {
  const { data: detail } = useGetFileItem(
    { path: item?.path ?? "" },
    {
      query: {
        enabled: !!item && !item.isFolder,
        queryKey: getGetFileItemQueryKey({ path: item?.path ?? "" }),
      },
    },
  );

  if (!item) return null;
  const d: FileDetail | undefined = detail;
  const url = previewUrl(item.path);

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
          <DialogTitle className="flex items-center justify-between gap-3 pr-10">
            <span className="truncate">{item.name}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.webUrl && (
                <a href={item.webUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> OneDrive
                  </Button>
                </a>
              )}
              <a href={downloadUrl(item.path)} download>
                <Button size="sm">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                </Button>
              </a>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="bg-black/[0.03] min-h-[60vh] max-h-[75vh] overflow-auto flex items-center justify-center">
          <PreviewBody item={item} detail={d} url={url} />
        </div>
        <div className="px-6 py-3 border-t border-border bg-card text-xs text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
          <span>{bytesToHuman(item.size)}</span>
          <span>{formatDate(item.lastModifiedAt)}</span>
          {item.mimeType && <span className="font-mono">{item.mimeType}</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TextPreview({ url }: { url: string }) {
  const MAX_BYTES = 256 * 1024;
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  useMemo(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const cut = buf.byteLength > MAX_BYTES;
        const slice = cut ? buf.slice(0, MAX_BYTES) : buf;
        const body = new TextDecoder("utf-8", { fatal: false }).decode(slice);
        if (!cancelled) {
          setText(body);
          setTruncated(cut);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (err) return <div className="p-8 text-sm text-destructive">Couldn't load text: {err}</div>;
  if (text == null)
    return (
      <div className="py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  return (
    <div className="w-full">
      {truncated && (
        <div className="text-xs text-muted-foreground px-3 py-2 border-b border-border">
          Showing first 256 KB. Download to see the full file.
        </div>
      )}
      <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-all p-4 max-h-[75vh] overflow-auto bg-white text-zinc-900">
        {text}
      </pre>
    </div>
  );
}

function PreviewBody({
  item,
  detail,
  url,
}: {
  item: FileItem;
  detail: FileDetail | undefined;
  url: string;
}) {
  const kind = detail?.previewKind;
  if (!kind) {
    return (
      <div className="py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  }
  if (kind === "image") {
    return <img src={url} alt={item.name} className="max-h-[75vh] object-contain" />;
  }
  if (kind === "pdf") {
    return <iframe title={item.name} src={url} className="w-full h-[75vh] border-0 bg-white" />;
  }
  if (kind === "video") {
    return <video src={url} controls className="max-h-[75vh] w-full bg-black" />;
  }
  if (kind === "audio") {
    return (
      <div className="p-12 w-full max-w-xl">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }
  if (kind === "text") {
    return <TextPreview url={url} />;
  }
  // office / other — no inline preview from Graph; encourage open in OneDrive / download.
  return (
    <div className="py-16 px-8 text-center max-w-md mx-auto">
      <FileIcon className="h-10 w-10 mx-auto text-muted-foreground" />
      <h3 className="mt-3 font-semibold">No inline preview</h3>
      <p className="text-sm text-muted-foreground mt-1">
        This file type can't be previewed in the browser. Download it or open in OneDrive.
      </p>
    </div>
  );
}
