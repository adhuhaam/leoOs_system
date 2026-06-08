import React from "react";
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowRight,
  Briefcase, Calendar, Camera, Check, CheckCircle,
  ChevronDown, ChevronRight, Clock, Copy, Cpu,
  DollarSign, Download, Eye, EyeOff, FilePlus,
  FileText, Folder, Globe, Grid3x3, Home, Image,
  Inbox, Key, Lock, LogOut, Mail, Maximize2,
  PenLine, Phone, Plus, RotateCcw, Save, Search,
  Shield, Trash2, Upload, CloudUpload, User, UserPlus,
  UserX, Users, X, Zap,
} from "lucide-react-native";

const ICON_MAP = {
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "briefcase": Briefcase,
  "calendar": Calendar,
  "camera": Camera,
  "check": Check,
  "check-circle": CheckCircle,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "clock": Clock,
  "copy": Copy,
  "cpu": Cpu,
  "dollar-sign": DollarSign,
  "download": Download,
  "edit-2": PenLine,
  "eye": Eye,
  "eye-off": EyeOff,
  "file-plus": FilePlus,
  "file-text": FileText,
  "folder": Folder,
  "globe": Globe,
  "grid": Grid3x3,
  "home": Home,
  "image": Image,
  "inbox": Inbox,
  "key": Key,
  "lock": Lock,
  "log-out": LogOut,
  "mail": Mail,
  "maximize-2": Maximize2,
  "phone": Phone,
  "plus": Plus,
  "rotate-ccw": RotateCcw,
  "save": Save,
  "search": Search,
  "shield": Shield,
  "trash-2": Trash2,
  "upload": Upload,
  "upload-cloud": CloudUpload,
  "user": User,
  "user-plus": UserPlus,
  "user-x": UserX,
  "users": Users,
  "x": X,
  "zap": Zap,
} as const;

type FeatherName = keyof typeof ICON_MAP;

interface FeatherProps {
  name: FeatherName | string;
  size?: number;
  color?: string;
  style?: object;
}

export function Feather({ name, size = 24, color }: FeatherProps) {
  const Icon = ICON_MAP[name as FeatherName];
  if (!Icon) return null;
  return <Icon size={size} color={color} />;
}
