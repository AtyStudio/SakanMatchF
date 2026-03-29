import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { useLocation } from "wouter";
import { useCreateListing } from "@workspace/api-client-react";
import { uploadFile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Image as ImageIcon, X, Upload, Crown, Star, BarChart2, Layers } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

interface PreviewImage {
  id: string;
  file: File;
  previewUrl: string;
  uploading: boolean;
  uploadedPath?: string;
  error?: string;
}

let nextId = 0;
const genId = () => `img-${++nextId}`;

function UpgradeModal({ reason, onClose }: { reason: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-3xl p-8 max-w-sm w-full border border-border shadow-2xl">
        <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-5">
          <Crown className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground text-center mb-2">{t("listings.upgradeModal.title")}</h2>
        <p className="text-muted-foreground text-center text-sm mb-6">{reason}</p>
        <ul className="space-y-3 mb-7">
          <li className="flex items-center gap-3 text-sm text-foreground">
            <Layers className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{t("listings.upgradeModal.unlimitedListings")}</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-foreground">
            <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{t("listings.upgradeModal.tenPhotos")}</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-foreground">
            <Star className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{t("listings.upgradeModal.priority")}</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-foreground">
            <BarChart2 className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{t("listings.upgradeModal.analytics")}</span>
          </li>
        </ul>
        <Link
          href="/premium"
          className="block w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold rounded-xl text-center hover:from-amber-600 hover:to-yellow-600 transition-all shadow-lg shadow-amber-500/20"
        >
          {t("listings.upgradeModal.viewPlans")}
        </Link>
        <button
          onClick={onClose}
          className="mt-3 block w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          {t("listings.upgradeModal.maybeLater")}
        </button>
      </div>
    </div>
  );
}

export default function NewListing() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPremium = user?.isPremium && user?.subscriptionStatus === "active";
  const imageLimit = isPremium ? 10 : 4;

  const createMutation = useCreateListing({
    mutation: {
      onSuccess: () => {
        toast({ title: t("listings.success"), description: t("listings.listingPublished") });
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        const code = err?.response?.data?.code;
        if (code === "upgrade_required") {
          setUpgradeReason(err?.response?.data?.message || t("listings.freePhotoLimit", { limit: imageLimit }));
          setShowUpgradeModal(true);
        } else {
          toast({ variant: "destructive", title: t("common.error"), description: err?.response?.data?.message || err.message || t("common.error") });
        }
      }
    }
  });

  useEffect(() => {
    if (!isAuthLoading && (!user || user.role !== "owner")) {
      setLocation("/");
    }
  }, [user, isAuthLoading]);

  const handleImageUpload = async (file: File, imageId: string) => {
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, uploading: true } : img));
    try {
      const { objectPath } = await uploadFile(file);
      setImages(prev => prev.map(img => img.id === imageId ? { ...img, uploading: false, uploadedPath: objectPath } : img));
    } catch {
      setImages(prev => prev.map(img => img.id === imageId ? { ...img, uploading: false, error: "Upload failed" } : img));
    }
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;

    setImages(prev => {
      const remaining = imageLimit - prev.length;
      if (remaining <= 0) {
        if (!isPremium) {
          setUpgradeReason(t("listings.freePhotoLimit", { limit: imageLimit }));
          setShowUpgradeModal(true);
        } else {
          toast({ variant: "destructive", title: t("listings.limitReached"), description: t("listings.tooManyImages") });
        }
        return prev;
      }

      const allowed = fileArray.slice(0, remaining);
      if (allowed.length < fileArray.length && !isPremium) {
        setUpgradeReason(t("listings.freePhotoLimit", { limit: imageLimit }));
        setShowUpgradeModal(true);
      }

      const newImages: PreviewImage[] = allowed.map(file => ({
        id: genId(),
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: false,
      }));

      newImages.forEach(img => {
        handleImageUpload(img.file, img.id);
      });

      return [...prev, ...newImages];
    });
  }, [imageLimit, isPremium]);

  const removeImage = (imageId: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === imageId);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter(i => i.id !== imageId);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stillUploading = images.some(img => img.uploading);
    if (stillUploading) {
      toast({ variant: "destructive", title: t("listings.pleaseWait"), description: t("listings.imagesUploading") });
      return;
    }

    if (images.length > imageLimit) {
      setUpgradeReason(t("listings.freePhotoLimit", { limit: imageLimit }));
      setShowUpgradeModal(!isPremium);
      if (isPremium) {
        toast({ variant: "destructive", title: t("listings.tooManyImages"), description: t("listings.tooManyImages") });
      }
      return;
    }

    const imageUrls = images
      .filter(img => img.uploadedPath)
      .map(img => img.uploadedPath as string);

    createMutation.mutate({
      data: {
        title,
        description: description || undefined,
        price: parseFloat(price),
        city,
        images: imageUrls
      }
    });
  };

  const isSubmitting = createMutation.isPending;
  const anyUploading = images.some(img => img.uploading);
  const atImageLimit = images.length >= imageLimit;

  if (isAuthLoading || !user || user.role !== "owner") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {showUpgradeModal && (
        <UpgradeModal reason={upgradeReason} onClose={() => setShowUpgradeModal(false)} />
      )}

      <main className="flex-grow max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("listings.backToDashboard")}
        </Link>

        <div className="bg-card rounded-3xl p-8 sm:p-10 border border-border/50 shadow-xl shadow-black/5">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground">{t("listings.createListing")}</h1>
            <p className="text-muted-foreground mt-2">{t("listings.createSubtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">{t("listings.listingTitle")}</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("listings.listingTitlePh")}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">{t("listings.city")}</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("listings.cityPh")}
                  className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">{t("listings.monthlyRent")}</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="100"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={t("listings.pricePh")}
                  className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">{t("listings.description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("listings.descriptionPh")}
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-foreground flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" /> {t("listings.photos")}
                </label>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${atImageLimit ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-secondary text-muted-foreground"}`}>
                  {images.length}/{imageLimit}
                  {!isPremium && <span className="ml-1 text-muted-foreground">({t("listings.freeLimit")})</span>}
                </span>
              </div>

              {!atImageLimit ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-primary/3"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                  />
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">{t("listings.clickToBrowse")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("listings.supportedFormats")}</p>
                </div>
              ) : (
                !isPremium && (
                  <div className="border-2 border-dashed border-amber-300 rounded-xl p-5 text-center bg-amber-50 dark:bg-amber-950/20">
                    <Crown className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground mb-1">{t("listings.photoLimitReached")}</p>
                    <p className="text-xs text-muted-foreground mb-3">{t("listings.freePhotoLimit", { limit: imageLimit })}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setUpgradeReason(t("listings.freePhotoLimit", { limit: imageLimit }));
                        setShowUpgradeModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all"
                    >
                      <Crown className="w-3.5 h-3.5" /> {t("listings.upgradeToPremium")}
                    </button>
                  </div>
                )
              )}

              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border-2 border-border group">
                      <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                      {img.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                      {img.error && (
                        <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center">
                          <span className="text-xs text-white font-medium px-1 text-center">{t("common.error")}</span>
                        </div>
                      )}
                      {!img.uploading && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                          className="absolute top-1 right-1 bg-background/90 backdrop-blur-sm text-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <button
                type="submit"
                disabled={isSubmitting || anyUploading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-4 rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {t("listings.publishing")}</>
                ) : anyUploading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {t("listings.uploadingImages")}</>
                ) : t("listings.publishListing")}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
