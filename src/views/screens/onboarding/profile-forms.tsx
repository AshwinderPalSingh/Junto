"use client";

import { Camera, ImagePlus, LockKeyhole, ShieldCheck, Upload } from "lucide-react";
import { useActionState, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { RULES } from "@/config/app";
import { BRANCHES, GENDERS, GROUP_PREFS, INTERESTS, VIBES, YEARS } from "@/config/profile";
import { COMMUNITY_GUIDELINES } from "@/config/safety";
import { idleState, type ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";
import { CameraCaptureDialog } from "@/views/components/camera-capture";
import { ChoiceCard, ChoiceChip } from "@/views/components/choice";
import { FormMessage, SubmitButton, fieldError } from "@/views/components/form-bits";
import { PhotoCropDialog } from "@/views/components/photo-cropper";
import { Button } from "@/views/ui/button";
import { Checkbox } from "@/views/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/views/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/views/ui/select";
import { Spinner } from "@/views/ui/spinner";
import { Textarea } from "@/views/ui/textarea";
import type { OnboardingVM } from "@/views/view-models";
import { CampusIdentity } from "@/views/components/campus-identity";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/* ───────────── About you ───────────── */

export function AboutForm({
  profile,
  action,
  submitLabel = "Continue",
  returnTo,
}: {
  profile: OnboardingVM["profile"];
  action: Action;
  submitLabel?: string;
  returnTo?: "profile";
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [bio, setBio] = useState(profile.bio);
  const full = interests.length >= RULES.maxInterests;

  return (
    <form action={formAction} className="space-y-8">
      {returnTo && <input type="hidden" name="return" value={returnTo} />}
      <div className="border-b border-border pb-5">
        <CampusIdentity fullName={profile.fullName} connected={profile.identityConnected} available={profile.identityAvailable} />
      </div>

      <FieldSet>
        <FieldLegend variant="label">I am a</FieldLegend>
        {profile.genderLocked ? (
          <p className="flex items-center gap-2 border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
            <LockKeyhole className="size-4" strokeWidth={1.75} />
            {GENDERS.find((g) => g.id === profile.gender)?.label ?? "—"} · locked after setup. A moderator can change it.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              {GENDERS.map((g) => (
                <ChoiceCard key={g.id} name="gender" value={g.id} defaultChecked={profile.gender === g.id} title={g.label} />
              ))}
            </div>
            <FieldDescription>
              Used only to respect everyone&apos;s comfort preferences. It&apos;s locked once you finish setup.
            </FieldDescription>
            <FieldError>{fieldError(state, "gender")}</FieldError>
          </>
        )}
      </FieldSet>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(fieldError(state, "year"))}>
          <FieldLabel>Year</FieldLabel>
          <Select name="year" defaultValue={profile.year || undefined}>
            <SelectTrigger className="h-11 w-full bg-[var(--glass-fill)]">
              <SelectValue placeholder="Choose your year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{fieldError(state, "year")}</FieldError>
        </Field>
        <Field data-invalid={Boolean(fieldError(state, "branch"))}>
          <FieldLabel>Department</FieldLabel>
          <Select name="branch" defaultValue={profile.branch || undefined}>
            <SelectTrigger className="h-14 w-full min-w-0 bg-[var(--glass-fill)] [&>[data-slot=select-value]]:line-clamp-2 [&>[data-slot=select-value]]:min-w-0 [&>[data-slot=select-value]]:whitespace-normal">
              <SelectValue placeholder="Choose your department" />
            </SelectTrigger>
            <SelectContent>
              {BRANCHES.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{fieldError(state, "branch")}</FieldError>
        </Field>
      </div>

      <FieldSet>
        <div className="flex items-baseline justify-between">
          <FieldLegend variant="label">Interests</FieldLegend>
          <span className="font-mono text-xs text-muted-foreground">
            {interests.length}/{RULES.maxInterests}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => {
            const checked = interests.includes(i.id);
            return (
              <ChoiceChip
                key={i.id}
                name="interests"
                value={i.id}
                checked={checked}
                disabled={!checked && full}
                onChange={(e) =>
                  setInterests((cur) => (e.target.checked ? [...cur, i.id] : cur.filter((x) => x !== i.id)))
                }
              >
                {i.label}
              </ChoiceChip>
            );
          })}
        </div>
        <FieldError>{fieldError(state, "interests")}</FieldError>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Your usual vibe (optional)</FieldLegend>
        <div className="flex flex-wrap gap-1.5">
          <ChoiceChip type="radio" name="vibe" value="" defaultChecked={!profile.vibe}>
            No preference
          </ChoiceChip>
          {VIBES.map((v) => (
            <ChoiceChip key={v.id} type="radio" name="vibe" value={v.id} defaultChecked={profile.vibe === v.id}>
              {v.label}
            </ChoiceChip>
          ))}
        </div>
      </FieldSet>

      <Field data-invalid={Boolean(fieldError(state, "bio"))}>
        <div className="flex items-baseline justify-between">
          <FieldLabel htmlFor="bio">A line about you (optional)</FieldLabel>
          <span className="font-mono text-xs text-muted-foreground">
            {bio.length}/{RULES.bioMaxLength}
          </span>
        </div>
        <Textarea
          id="bio"
          name="bio"
          value={bio}
          maxLength={RULES.bioMaxLength}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Always up for a chai break between labs."
          className="min-h-20"
        />
        <FieldError>{fieldError(state, "bio")}</FieldError>
      </Field>

      <FormMessage state={state} />
      <SubmitButton size="xl" className="w-full sm:w-auto sm:px-10">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

/* ───────────── Who you're comfortable meeting ───────────── */

export function PreferencesForm({
  preferences,
  action,
  submitLabel = "Continue",
  returnTo,
}: {
  preferences: OnboardingVM["preferences"];
  action: Action;
  submitLabel?: string;
  returnTo?: "settings";
}) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="space-y-8">
      {returnTo && <input type="hidden" name="return" value={returnTo} />}
      <FieldSet>
        <FieldLegend variant="label">Who are you comfortable meeting?</FieldLegend>
        <div className="grid gap-2 sm:grid-cols-3">
          {GENDERS.map((g) => (
            <ChoiceCard
              key={g.id}
              type="checkbox"
              name="companionGenders"
              value={g.id}
              defaultChecked={preferences.companionGenders.includes(g.id)}
              title={g.plural}
            />
          ))}
        </div>
        <FieldError>{fieldError(state, "companionGenders")}</FieldError>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">One-on-one or groups?</FieldLegend>
        <div className="grid gap-2">
          {GROUP_PREFS.map((g) => (
            <ChoiceCard
              key={g.id}
              name="groupPref"
              value={g.id}
              defaultChecked={preferences.groupPref === g.id}
              title={g.label}
              description={g.hint}
            />
          ))}
        </div>
      </FieldSet>

      <p className="flex gap-3 border border-border p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
        <span>
          <strong className="font-semibold">Private by design.</strong> These choices never appear on your profile.
          They quietly filter plans both ways, so you only see — and are only seen by — people who are comfortable with
          each other.
        </span>
      </p>

      <FormMessage state={state} />
      {state.status === "success" && <p className="text-sm text-foreground">{state.message}</p>}
      <SubmitButton size="xl" className="w-full sm:w-auto sm:px-10">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

/* ───────────── The one profile photo ───────────── */

export function PhotoUploader({
  photo,
  action,
  footer,
}: {
  photo: OnboardingVM["photo"];
  action: (prev: ActionState<{ url: string }>, formData: FormData) => Promise<ActionState<{ url: string }>>;
  /** Rendered below the uploader; receives whether a photo is in place. */
  footer?: (hasPhoto: boolean) => React.ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(action, idleState);
  const [, startTransition] = useTransition();
  const [source, setSource] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  const shown =
    pending && localPreview
      ? localPreview
      : state.status === "success" && state.data
        ? state.data.url
        : photo.url;

  async function pick(file: File | undefined | null) {
    setOpening(false);
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      toast.error("That isn't an image. Choose a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > RULES.photo.maxBytes * 4) {
      toast.error("That file is very large. Choose a photo under 20 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    // Make sure this browser can open it (iPhone HEIC photos only open in Safari).
    const readable = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    if (!readable) {
      URL.revokeObjectURL(url);
      toast.error("Your browser can't open this photo format (often HEIC from iPhones). Use a JPG or PNG, or take a photo.");
      return;
    }
    setSource(url);
  }

  function openPicker() {
    setOpening(true);
    const reset = () => setTimeout(() => setOpening(false), 300);
    window.addEventListener("focus", reset, { once: true });
    setTimeout(() => setOpening(false), 20_000);
    fileRef.current?.click();
  }

  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      void pick(file);
    }
  });
  useEffect(() => {
    const listener = (event: ClipboardEvent) => onPaste(event);
    window.addEventListener("paste", listener);
    return () => window.removeEventListener("paste", listener);
  }, []);

  function upload(blob: Blob) {
    setSource(null);
    setLocalPreview(URL.createObjectURL(blob));
    const fd = new FormData();
    fd.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void pick(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "glass flex flex-col items-center gap-6 border-dashed p-6 text-center transition-colors sm:flex-row sm:text-left",
          dragging && "border-foreground bg-accent",
        )}
      >
        <div className="relative">
          <div className="grid size-32 place-items-center overflow-hidden bg-muted ring-1 ring-border">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="Your profile photo" className="size-full object-cover" />
            ) : (
              <Camera className="size-9 text-muted-foreground" strokeWidth={1.5} />
            )}
          </div>
          {pending && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm" role="status">
              <Spinner className="size-6" />
              <span className="text-xs">Checking photo...</span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-lg font-semibold tracking-[-0.02em]">{shown ? "That's you" : "Add a clear photo of your face"}</p>
            <p className="text-sm text-muted-foreground">
              Just one photo — this isn&apos;t Instagram. It helps people recognise you at the meeting spot.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            // Explicit types: `image/*` makes some browsers slow to open the system picker.
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button type="button" variant={shown ? "outline" : "default"} onClick={openPicker} disabled={pending}>
              {opening ? <Spinner /> : shown ? <Upload /> : <ImagePlus />}
              {opening ? "Opening…" : shown ? "Change photo" : "Choose photo"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCamera(true)} disabled={pending}>
              <Camera /> Take a photo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {dragging ? "Drop it here" : "Or drag a photo here, or paste one with ⌘V."}
          </p>
        </div>
      </div>

      {photo.rejected && state.status !== "success" && (
        <p className="border border-foreground/30 p-4 text-sm">
          A moderator asked for a new photo. Please upload a clear, recent photo of your face.
        </p>
      )}
      <FormMessage state={state} />

      <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        {["Recent and clearly you", "Face visible, no sunglasses", "Just you, no group shots", "No filters or avatars"].map(
          (rule) => (
            <li key={rule} className="flex items-center gap-2.5">
              <span className="size-1.5 bg-foreground" /> {rule}
            </li>
          ),
        )}
      </ul>
      <p className="flex gap-3 border border-border p-4 text-sm">
        <LockKeyhole className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
        <span>
          Only signed-in members of your campus can see it. Location data is stripped from the file.
        </span>
      </p>

      {footer?.(!pending && (state.status === "success" || Boolean(photo.url && !photo.rejected)))}
      <PhotoCropDialog key={source ?? "closed"} src={source} onCancel={() => setSource(null)} onConfirm={upload} />
      {camera && (
        <CameraCaptureDialog
          onCancel={() => setCamera(false)}
          onCapture={(url) => {
            setCamera(false);
            setSource(url);
          }}
        />
      )}
    </div>
  );
}

/* ───────────── Community guidelines ───────────── */

export function GuidelinesForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="space-y-6">
      <ol className="glass divide-y divide-border">
        {COMMUNITY_GUIDELINES.map((g, i) => (
          <li key={g.title} className="flex gap-4 p-4">
            <span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <span>
              <span className="block font-semibold">{g.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{g.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="glass space-y-3 p-4">
        <Field orientation="horizontal">
          <Checkbox id="adult" name="adult" />
          <FieldLabel htmlFor="adult" className="font-normal">
            I&apos;m 18 or older.
          </FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="guidelines" name="guidelines" />
          <FieldLabel htmlFor="guidelines" className="font-normal">
            I&apos;ll follow these guidelines and meet only at public spots.
          </FieldLabel>
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton size="xl" className="w-full" pendingLabel="Setting things up…">
        Start exploring
      </SubmitButton>
    </form>
  );
}
