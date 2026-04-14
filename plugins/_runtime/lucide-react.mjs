/**
 * lucide-react runtime shim for Studio plugins.
 * esbuild aliases "lucide-react" → this file.
 * Spreads all Lucide icons from globalThis.__studio_icons.
 */
const icons = globalThis.__studio_icons || {}
export default icons

// Re-export all icons by name
export const {
  Bot, Wrench, MessageSquare, Search, Plus, X, Minus,
  ChevronDown, ChevronRight, ChevronUp, ChevronLeft,
  Folder, FolderOpen, File, FileText, FilePlus, FileEdit,
  Tag, Calendar, Clock, User, Users, Settings, SettingsIcon,
  Layout, LayoutGrid, LayoutList, Layers,
  Check, CheckCircle, AlertCircle, AlertTriangle, Info,
  Edit, Edit2, Edit3, Pencil, Trash, Trash2,
  Copy, Clipboard, ClipboardList, ClipboardCheck,
  Link, ExternalLink, Share, Share2,
  Download, Upload, RefreshCw, RotateCw,
  Eye, EyeOff, Lock, Unlock, Shield,
  Star, Heart, Bookmark, Flag,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Home, Globe, Mail, Phone, Send,
  Code, Code2, Terminal, Database, Server,
  Loader, Loader2, Spinner,
  Filter, SortAsc, SortDesc,
  Maximize, Minimize, Expand, Shrink,
  MoreHorizontal, MoreVertical, Menu, Grid,
  ZoomIn, ZoomOut, Move,
  Play, Pause, Stop, SkipForward, SkipBack,
  Volume, Volume2, VolumeX, Mic, MicOff,
  Camera, Image, Video, Music,
  Map, MapPin, Navigation, Compass,
  Cpu, Memory, HardDrive, Wifi, Bluetooth,
  Sun, Moon, Cloud, CloudRain, Wind,
  Zap, Activity, BarChart, BarChart2, LineChart, PieChart,
  TrendingUp, TrendingDown,
  Package, Box, Archive, Inbox,
  Sparkles, Wand2, Magic, Rocket,
  Radio, Broadcast, Signal,
} = icons
