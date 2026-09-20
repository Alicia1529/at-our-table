"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dinners as seedDinners, wines as seedWines, wineExperiences as seedExperiences } from "@/lib/mock-data";
import type { Course, Dinner, DinnerLocation, DinnerNote, DinnerPhoto, Pairing, ShareLink, TableSpace, VoiceNote, Wine, WineDraft, WineExperience } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type DinnerDraft = { title: string; date: string; locationType: DinnerLocation; venue: string; guests: string[]; courses: string[] };
type AppState = { dinners: Dinner[]; wines: Wine[]; wineExperiences: WineExperience[]; space: TableSpace; shareLinks: ShareLink[] };
type AppData = AppState & {
  ready: boolean; mode: "demo" | "live"; viewer: { id: string; name: string };
  createDinner: (draft: DinnerDraft) => Promise<string>;
  updateDinner: (id: string, patch: Partial<Pick<Dinner, "title" | "date" | "locationType" | "venue" | "guests" | "summary" | "status">>) => Promise<void>;
  addCourse: (dinnerId: string, title: string, description?: string) => Promise<void>;
  updateCourse: (dinnerId: string, courseId: string, title: string, description?: string) => Promise<void>;
  addWine: (draft: WineDraft) => Promise<string>;
  updateWine: (id: string, draft: WineDraft) => Promise<void>;
  openWine: (dinnerId: string, wineId: string, servingNote?: string) => Promise<string>;
  pairWine: (dinnerId: string, courseId: string, experienceId: string, note?: string) => Promise<void>;
  ratePairing: (dinnerId: string, pairingId: string, rating: number, note?: string) => Promise<void>;
  addNote: (dinnerId: string, body: string) => Promise<void>;
  addPhotos: (dinnerId: string, files: File[]) => Promise<void>;
  addVoiceNote: (dinnerId: string, blob: Blob, durationSeconds: number) => Promise<void>;
  updateSpace: (name: string, tagline: string) => Promise<void>;
  inviteMember: (email: string) => Promise<string>;
  createShareLink: (dinnerId: string) => Promise<string>;
};

const STORAGE_KEY = "at-our-table-v1";
const SHARE_KEY = "at-our-table-shares-v1";
const defaultSpace: TableSpace = { id: "demo-space", name: "Our table", tagline: "The dinners we want to remember", members: [
  { id: "alicia", name: "Alicia", email: "alicia@example.com", role: "owner" },
  { id: "maya", name: "Maya", email: "maya@example.com", role: "member" },
  { id: "theo", name: "Theo", email: "theo@example.com", role: "member" },
] };
const seedState = (): AppState => ({ dinners: structuredClone(seedDinners), wines: structuredClone(seedWines), wineExperiences: structuredClone(seedExperiences), space: structuredClone(defaultSpace), shareLinks: [] });
const AppDataContext = createContext<AppData | null>(null);
const uid = () => crypto.randomUUID();

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const live = isSupabaseConfigured();
  const [state, setState] = useState<AppState>(seedState);
  const [viewer, setViewer] = useState({ id: "alicia", name: "Alicia" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!live) {
      const timer = window.setTimeout(() => { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) { try { setState(JSON.parse(saved) as AppState); } catch { setState(seedState()); } } setReady(true); }, 0);
      return () => window.clearTimeout(timer);
    }
    const supabase = createClient();
    void Promise.all([loadLiveState(), supabase.auth.getUser()]).then(([next, userResult]) => { if (next) setState(next); if (userResult.data.user) setViewer({ id: userResult.data.user.id, name: displayName(userResult.data.user) }); setReady(true); }).catch(() => setReady(true));
  }, [live]);

  useEffect(() => { if (ready && !live) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [live, ready, state]);

  const createDinner = useCallback(async (draft: DinnerDraft) => {
    const localId = uid(); let dinnerId = localId; let createdCourses: Course[] = draft.courses.map((title, index) => ({ id: uid(), title, description: "", position: index + 1 }));
    if (live) {
      const supabase = createClient(); const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in to create a dinner.");
      const { data, error } = await supabase.from("dinners").insert({ space_id: state.space.id, created_by: userData.user.id, title: draft.title, scheduled_at: draft.date, location_type: draft.locationType, venue_name: draft.venue, status: "planning" }).select("id").single();
      if (error) throw error; dinnerId = data.id;
      if (draft.guests.length) { const { error: guestError } = await supabase.from("dinner_guests").insert(draft.guests.map((name) => ({ space_id: state.space.id, dinner_id: dinnerId, display_name: name }))); if (guestError) throw guestError; }
      if (draft.courses.length) { const { data: courseData, error: courseError } = await supabase.from("courses").insert(draft.courses.map((title, index) => ({ space_id: state.space.id, dinner_id: dinnerId, position: index + 1, title }))).select("id,title,description,position"); if (courseError) throw courseError; createdCourses = (courseData ?? []).map((course) => ({ id: course.id, title: course.title, description: course.description ?? "", position: course.position })); }
    }
    const dinner: Dinner = { id: dinnerId, title: draft.title, date: draft.date, locationType: draft.locationType, venue: draft.venue, status: "planning", guests: draft.guests, summary: "", coverImage: "/table-hero.jpg", courses: createdCourses, wineExperienceIds: [], pairings: [], ratings: [], photoCount: 0, notes: [], photos: [], voiceNotes: [] };
    setState((current) => ({ ...current, dinners: [dinner, ...current.dinners] })); return dinnerId;
  }, [live, state.space.id]);

  const updateDinner = useCallback(async (id: string, patch: Partial<Pick<Dinner, "title" | "date" | "locationType" | "venue" | "guests" | "summary" | "status">>) => {
    if (live) { const supabase = createClient(); const dbPatch = { ...(patch.title !== undefined && { title: patch.title }), ...(patch.date !== undefined && { scheduled_at: patch.date }), ...(patch.locationType !== undefined && { location_type: patch.locationType }), ...(patch.venue !== undefined && { venue_name: patch.venue }), ...(patch.summary !== undefined && { summary: patch.summary }), ...(patch.status !== undefined && { status: patch.status }) }; const { error } = await supabase.from("dinners").update(dbPatch).eq("id", id); if (error) throw error; if (patch.guests !== undefined) { const { error: deleteError } = await supabase.from("dinner_guests").delete().eq("dinner_id", id); if (deleteError) throw deleteError; if (patch.guests.length) { const { error: guestError } = await supabase.from("dinner_guests").insert(patch.guests.map((displayName) => ({ space_id: state.space.id, dinner_id: id, display_name: displayName }))); if (guestError) throw guestError; } } }
    setState((current) => ({ ...current, dinners: current.dinners.map((dinner) => dinner.id === id ? { ...dinner, ...patch } : dinner) }));
  }, [live, state.space.id]);

  const addCourse = useCallback(async (dinnerId: string, title: string, description = "") => {
    const dinner = state.dinners.find((item) => item.id === dinnerId); if (!dinner) return; let courseId = uid();
    if (live) { const { data, error } = await createClient().from("courses").insert({ space_id: state.space.id, dinner_id: dinnerId, position: dinner.courses.length + 1, title, description }).select("id").single(); if (error) throw error; courseId = data.id; }
    const course: Course = { id: courseId, title, description, position: dinner.courses.length + 1 };
    setState((current) => ({ ...current, dinners: current.dinners.map((item) => item.id === dinnerId ? { ...item, courses: [...item.courses, course] } : item) }));
  }, [live, state.dinners, state.space.id]);

  const updateCourse = useCallback(async (dinnerId: string, courseId: string, title: string, description = "") => {
    if (live) { const { error } = await createClient().from("courses").update({ title, description }).eq("id", courseId); if (error) throw error; }
    setState((current) => ({ ...current, dinners: current.dinners.map((dinner) => dinner.id === dinnerId ? { ...dinner, courses: dinner.courses.map((course) => course.id === courseId ? { ...course, title, description } : course) } : dinner) }));
  }, [live]);

  const addWine = useCallback(async (draft: WineDraft) => {
    let wineId = uid(); let imageUrl: string | undefined;
    if (live) {
      const supabase = createClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) throw new Error("Sign in to add wine.");
      const { data, error } = await supabase.from("wines").insert({ space_id: state.space.id, created_by: userData.user.id, producer: draft.producer, cuvee: draft.cuvee, vintage: draft.vintage, region: draft.region, country: draft.country, grapes: draft.grapes, color: draft.color === "rosé" ? "rose" : draft.color, reference_notes: draft.description, tasting_notes: draft.tastingNotes }).select("id").single(); if (error) throw error; wineId = data.id;
      if (draft.labelFile) { const path = `${state.space.id}/wine-labels/${wineId}-${safeName(draft.labelFile.name)}`; const { error: uploadError } = await supabase.storage.from("dinner-media").upload(path, draft.labelFile); if (uploadError) throw uploadError; const { error: updateError } = await supabase.from("wines").update({ label_photo_path: path }).eq("id", wineId); if (updateError) throw updateError; const { data: signed } = await supabase.storage.from("dinner-media").createSignedUrl(path, 3600); imageUrl = signed?.signedUrl; }
    } else if (draft.labelFile) imageUrl = await fileToDataUrl(draft.labelFile);
    const { labelFile: _labelFile, ...profile } = draft; void _labelFile;
    const wine: Wine = { id: wineId, ...profile, imageUrl, bottlesOpened: 0 }; setState((current) => ({ ...current, wines: [wine, ...current.wines] })); return wineId;
  }, [live, state.space.id]);

  const updateWine = useCallback(async (id: string, draft: WineDraft) => {
    let imageUrl: string | undefined;
    if (live) { const supabase = createClient(); const patch: Record<string, unknown> = { producer: draft.producer, cuvee: draft.cuvee, vintage: draft.vintage, region: draft.region, country: draft.country, grapes: draft.grapes, color: draft.color === "rosé" ? "rose" : draft.color, reference_notes: draft.description, tasting_notes: draft.tastingNotes }; if (draft.labelFile) { const path = `${state.space.id}/wine-labels/${id}-${safeName(draft.labelFile.name)}`; const { error: uploadError } = await supabase.storage.from("dinner-media").upload(path, draft.labelFile, { upsert: true }); if (uploadError) throw uploadError; patch.label_photo_path = path; const { data: signed } = await supabase.storage.from("dinner-media").createSignedUrl(path, 3600); imageUrl = signed?.signedUrl; } const { error } = await supabase.from("wines").update(patch).eq("id", id); if (error) throw error; }
    else if (draft.labelFile) imageUrl = await fileToDataUrl(draft.labelFile);
    const { labelFile: _labelFile, ...profile } = draft; void _labelFile;
    setState((current) => ({ ...current, wines: current.wines.map((wine) => wine.id === id ? { ...wine, ...profile, imageUrl: imageUrl ?? wine.imageUrl } : wine) }));
  }, [live, state.space.id]);

  const openWine = useCallback(async (dinnerId: string, wineId: string, servingNote = "") => {
    const existing = state.wineExperiences.find((experience) => experience.dinnerId === dinnerId && experience.wineId === wineId);
    if (existing) {
      if (servingNote && servingNote !== existing.servingNote) {
        if (live) { const { error } = await createClient().from("wine_experiences").update({ serving_notes: servingNote }).eq("id", existing.id); if (error) throw error; }
        setState((current) => ({ ...current, wineExperiences: current.wineExperiences.map((experience) => experience.id === existing.id ? { ...experience, servingNote } : experience) }));
      }
      return existing.id;
    }
    let experienceId = uid();
    if (live) { const supabase = createClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) throw new Error("Sign in to open a wine."); const { data, error } = await supabase.from("wine_experiences").insert({ space_id: state.space.id, dinner_id: dinnerId, wine_id: wineId, serving_notes: servingNote, created_by: userData.user.id }).select("id").single(); if (error) throw error; experienceId = data.id; }
    const experience: WineExperience = { id: experienceId, wineId, dinnerId, openedAt: new Date().toISOString(), servingNote, rating: 0 };
    setState((current) => ({ ...current, wineExperiences: [experience, ...current.wineExperiences], wines: current.wines.map((wine) => wine.id === wineId ? { ...wine, bottlesOpened: wine.bottlesOpened + 1 } : wine), dinners: current.dinners.map((dinner) => dinner.id === dinnerId ? { ...dinner, wineExperienceIds: [...dinner.wineExperienceIds, experienceId] } : dinner) })); return experienceId;
  }, [live, state.space.id, state.wineExperiences]);

  const pairWine = useCallback(async (dinnerId: string, courseId: string, experienceId: string, note = "") => {
    const existing = state.dinners.find((dinner) => dinner.id === dinnerId)?.pairings.find((pairing) => pairing.courseId === courseId); let pairingId = existing?.id ?? uid();
    if (live) { const payload = { space_id: state.space.id, dinner_id: dinnerId, course_id: courseId, wine_experience_id: experienceId, notes: note }; if (existing) { const { error } = await createClient().from("course_wine_pairings").update(payload).eq("id", existing.id); if (error) throw error; } else { const { data, error } = await createClient().from("course_wine_pairings").insert(payload).select("id").single(); if (error) throw error; pairingId = data.id; } }
    const pairing: Pairing = { id: pairingId, courseId, wineExperienceId: experienceId, note }; setState((current) => ({ ...current, dinners: current.dinners.map((dinner) => dinner.id === dinnerId ? { ...dinner, pairings: [...dinner.pairings.filter((item) => item.courseId !== courseId), pairing] } : dinner) }));
  }, [live, state.dinners, state.space.id]);

  const ratePairing = useCallback(async (dinnerId: string, pairingId: string, rating: number, note = "") => {
    const clamped = Math.max(1, Math.min(5, rating)) as 1 | 2 | 3 | 4 | 5; let personId = "alicia"; let personName = "Alicia"; let supabase: ReturnType<typeof createClient> | null = null;
    if (live) { supabase = createClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) throw new Error("Sign in to rate a pairing."); personId = userData.user.id; personName = displayName(userData.user); }
    const dinner = state.dinners.find((item) => item.id === dinnerId); const existing = dinner?.ratings.find((item) => item.targetType === "pairing" && item.targetId === pairingId && item.personId === personId); let ratingId = existing?.id ?? uid();
    if (supabase) { const payload = { space_id: state.space.id, dinner_id: dinnerId, target_type: "pairing", pairing_id: pairingId, rater_user_id: personId, rating: clamped, notes: note }; if (existing) { const { error } = await supabase.from("ratings").update(payload).eq("id", existing.id); if (error) throw error; } else { const { data, error } = await supabase.from("ratings").insert(payload).select("id").single(); if (error) throw error; ratingId = data.id; } }
    setState((current) => ({ ...current, dinners: current.dinners.map((item) => item.id === dinnerId ? { ...item, ratings: [...item.ratings.filter((value) => value.id !== ratingId), { id: ratingId, personId, personName, targetType: "pairing", targetId: pairingId, rating: clamped, note }] } : item) }));
  }, [live, state.dinners, state.space.id]);

  const addNote = useCallback(async (dinnerId: string, body: string) => {
    let noteId = uid(); let authorName = "Alicia"; if (live) { const supabase = createClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) throw new Error("Sign in to add a note."); authorName = displayName(userData.user); const { data, error } = await supabase.from("dinner_notes").insert({ space_id: state.space.id, dinner_id: dinnerId, author_id: userData.user.id, body }).select("id").single(); if (error) throw error; noteId = data.id; }
    const note: DinnerNote = { id: noteId, dinnerId, authorName, body, createdAt: new Date().toISOString() }; setState((current) => ({ ...current, dinners: current.dinners.map((dinner) => dinner.id === dinnerId ? { ...dinner, notes: [...(dinner.notes ?? []), note] } : dinner) }));
  }, [live, state.space.id]);

  const addPhotos = useCallback(async (dinnerId: string, files: File[]) => {
    const photos: DinnerPhoto[] = [];
    for (const file of files) { const id = uid(); let url = await fileToDataUrl(file); if (live) { const supabase = createClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) throw new Error("Sign in to upload photos."); const path = `${state.space.id}/${dinnerId}/${id}-${safeName(file.name)}`; const { error: uploadError } = await supabase.storage.from("dinner-media").upload(path, file); if (uploadError) throw uploadError; const { error } = await supabase.from("photos").insert({ id, space_id: state.space.id, dinner_id: dinnerId, uploaded_by: userData.user.id, storage_path: path }); if (error) throw error; const { data } = await supabase.storage.from("dinner-media").createSignedUrl(path, 3600); url = data?.signedUrl ?? ""; } photos.push({ id, dinnerId, url, caption: file.name, createdAt: new Date().toISOString() }); }
    setState((current) => ({ ...current, dinners: current.dinners.map((dinner) => dinner.id === dinnerId ? { ...dinner, photos: [...(dinner.photos ?? []), ...photos], photoCount: dinner.photoCount + photos.length } : dinner) }));
  }, [live, state.space.id]);

  const addVoiceNote = useCallback(async (dinnerId: string, blob: Blob, durationSeconds: number) => {
    const id = uid(); let url = await blobToDataUrl(blob); if (live) { const supabase = createClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) throw new Error("Sign in to save a voice note."); const path = `${state.space.id}/${dinnerId}/${id}.webm`; const { error: uploadError } = await supabase.storage.from("dinner-media").upload(path, blob, { contentType: blob.type || "audio/webm" }); if (uploadError) throw uploadError; const { error } = await supabase.from("voice_notes").insert({ id, space_id: state.space.id, dinner_id: dinnerId, created_by: userData.user.id, storage_path: path, duration_seconds: durationSeconds }); if (error) throw error; const { data } = await supabase.storage.from("dinner-media").createSignedUrl(path, 3600); url = data?.signedUrl ?? ""; }
    const voice: VoiceNote = { id, dinnerId, url, durationSeconds, createdAt: new Date().toISOString() }; setState((current) => ({ ...current, dinners: current.dinners.map((dinner) => dinner.id === dinnerId ? { ...dinner, voiceNotes: [...(dinner.voiceNotes ?? []), voice] } : dinner) }));
  }, [live, state.space.id]);

  const updateSpace = useCallback(async (name: string, tagline: string) => { if (live) { const { error } = await createClient().from("spaces").update({ name, tagline }).eq("id", state.space.id); if (error) throw error; } setState((current) => ({ ...current, space: { ...current.space, name, tagline } })); }, [live, state.space.id]);
  const inviteMember = useCallback(async (email: string) => { let token = uid().replaceAll("-", ""); if (live) { const { data, error } = await createClient().rpc("create_space_invitation", { target_space_id: state.space.id, invite_email: email }); if (error) throw error; token = data as string; } setState((current) => ({ ...current, space: { ...current.space, members: [...current.space.members, { id: uid(), name: email.split("@")[0], email, role: "pending" }] } })); return `${window.location.origin}/invite/${token}`; }, [live, state.space.id]);
  const createShareLink = useCallback(async (dinnerId: string) => { let token = uid().replaceAll("-", ""); if (live) { const { data, error } = await createClient().rpc("create_dinner_share_link", { target_dinner_id: dinnerId }); if (error) throw error; token = data as string; } const link = { token, dinnerId, createdAt: new Date().toISOString() }; setState((current) => ({ ...current, shareLinks: [...current.shareLinks, link] })); if (!live) { const stored = JSON.parse(window.localStorage.getItem(SHARE_KEY) ?? "{}") as Record<string, Dinner>; const dinner = state.dinners.find((item) => item.id === dinnerId); if (dinner) { stored[token] = dinner; window.localStorage.setItem(SHARE_KEY, JSON.stringify(stored)); } } return `${window.location.origin}/share/${token}`; }, [live, state.dinners]);

  const value = useMemo<AppData>(() => ({ ...state, ready, mode: live ? "live" : "demo", viewer, createDinner, updateDinner, addCourse, updateCourse, addWine, updateWine, openWine, pairWine, ratePairing, addNote, addPhotos, addVoiceNote, updateSpace, inviteMember, createShareLink }), [state, ready, live, viewer, createDinner, updateDinner, addCourse, updateCourse, addWine, updateWine, openWine, pairWine, ratePairing, addNote, addPhotos, addVoiceNote, updateSpace, inviteMember, createShareLink]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() { const value = useContext(AppDataContext); if (!value) throw new Error("useAppData must be used inside AppDataProvider"); return value; }

async function loadLiveState(): Promise<AppState | null> {
  const supabase = createClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) return null;
  const { data: membership } = await supabase.from("space_members").select("space_id, role,joined_at").order("joined_at", { ascending: false }).limit(1).maybeSingle(); if (!membership) return null; const spaceId = membership.space_id;
  const [spaceResult, membersResult, dinnersResult, guestsResult, coursesResult, winesResult, experiencesResult, pairingsResult, ratingsResult, notesResult, photosResult, voicesResult] = await Promise.all([
    supabase.from("spaces").select("id,name,tagline").eq("id", spaceId).single(), supabase.from("space_members").select("user_id,role").eq("space_id", spaceId), supabase.from("dinners").select("*").eq("space_id", spaceId).order("scheduled_at", { ascending: false }), supabase.from("dinner_guests").select("*").eq("space_id", spaceId), supabase.from("courses").select("*").eq("space_id", spaceId).order("position"), supabase.from("wines").select("*").eq("space_id", spaceId), supabase.from("wine_experiences").select("*").eq("space_id", spaceId), supabase.from("course_wine_pairings").select("*").eq("space_id", spaceId), supabase.from("ratings").select("*").eq("space_id", spaceId), supabase.from("dinner_notes").select("*").eq("space_id", spaceId), supabase.from("photos").select("*").eq("space_id", spaceId), supabase.from("voice_notes").select("*").eq("space_id", spaceId),
  ]);
  const rows = <T,>(result: { data: T[] | null }) => result.data ?? [];
  const photoRows = rows<Record<string, unknown>>(photosResult); const voiceRows = rows<Record<string, unknown>>(voicesResult); const wineRows = rows<Record<string, unknown>>(winesResult); const mediaPaths = [...photoRows, ...voiceRows, ...wineRows.filter((item) => item.label_photo_path)].map((item) => String(item.storage_path ?? item.label_photo_path)); const signedUrls = new Map<string, string>();
  if (mediaPaths.length) { const { data: signed } = await supabase.storage.from("dinner-media").createSignedUrls(mediaPaths, 3600); (signed ?? []).forEach((item) => { if (item.signedUrl && item.path) signedUrls.set(item.path, item.signedUrl); }); }
  const wineList: Wine[] = wineRows.map((row) => ({ id: String(row.id), producer: String(row.producer), cuvee: String(row.cuvee ?? ""), vintage: Number(row.vintage ?? 0), region: String(row.region ?? ""), country: String(row.country ?? ""), grapes: (row.grapes as string[]) ?? [], color: row.color === "rose" ? "rosé" : row.color as Wine["color"], bottlesOpened: rows<Record<string, unknown>>(experiencesResult).filter((item) => item.wine_id === row.id).length, description: String(row.reference_notes ?? ""), tastingNotes: String(row.tasting_notes ?? ""), imageUrl: row.label_photo_path ? signedUrls.get(String(row.label_photo_path)) : undefined }));
  const allRatingRows = rows<Record<string, unknown>>(ratingsResult);
  const experienceList: WineExperience[] = rows<Record<string, unknown>>(experiencesResult).map((row) => { const experienceRatings = allRatingRows.filter((rating) => rating.wine_experience_id === row.id).map((rating) => Number(rating.rating)); return { id: String(row.id), wineId: String(row.wine_id), dinnerId: String(row.dinner_id ?? ""), openedAt: String(row.opened_at), servingNote: String(row.serving_notes ?? ""), rating: experienceRatings.length ? experienceRatings.reduce((sum, value) => sum + value, 0) / experienceRatings.length : 0 }; });
  const currentUserName = displayName(userData.user);
  const dinnerList: Dinner[] = rows<Record<string, unknown>>(dinnersResult).map((row) => { const id = String(row.id); const guestRows = rows<Record<string, unknown>>(guestsResult).filter((item) => item.dinner_id === id); const courseRows = rows<Record<string, unknown>>(coursesResult).filter((item) => item.dinner_id === id); const pairingRows = rows<Record<string, unknown>>(pairingsResult).filter((item) => item.dinner_id === id); const ratingRows = allRatingRows.filter((item) => item.dinner_id === id); const dinnerPhotos = photoRows.filter((item) => item.dinner_id === id); return { id, title: String(row.title), date: String(row.scheduled_at ?? new Date().toISOString()), locationType: row.location_type as DinnerLocation, venue: String(row.venue_name ?? ""), status: row.status as Dinner["status"], guests: guestRows.map((item) => String(item.display_name)), summary: String(row.summary ?? ""), coverImage: "/table-hero.jpg", courses: courseRows.map((item) => ({ id: String(item.id), title: String(item.title), description: String(item.description ?? ""), position: Number(item.position) })), wineExperienceIds: experienceList.filter((item) => item.dinnerId === id).map((item) => item.id), pairings: pairingRows.map((item) => ({ id: String(item.id), courseId: String(item.course_id), wineExperienceId: String(item.wine_experience_id), note: String(item.notes ?? "") })), ratings: ratingRows.map((item) => ({ id: String(item.id), personId: item.rater_user_id ? String(item.rater_user_id) : undefined, personName: item.rater_user_id === userData.user.id ? currentUserName : "Guest", targetType: item.target_type as "course" | "wine_experience" | "pairing", targetId: String(item.course_id ?? item.wine_experience_id ?? item.pairing_id), rating: Number(item.rating) as 1 | 2 | 3 | 4 | 5, note: String(item.notes ?? "") })), photoCount: dinnerPhotos.length, notes: rows<Record<string, unknown>>(notesResult).filter((item) => item.dinner_id === id).map((item) => ({ id: String(item.id), dinnerId: id, authorName: item.author_id === userData.user.id ? currentUserName : "Member", body: String(item.body), createdAt: String(item.created_at) })), photos: dinnerPhotos.map((item) => ({ id: String(item.id), dinnerId: id, courseId: item.course_id ? String(item.course_id) : undefined, url: signedUrls.get(String(item.storage_path)) ?? "", caption: String(item.caption ?? "Dinner memory"), createdAt: String(item.created_at) })), voiceNotes: voiceRows.filter((item) => item.dinner_id === id).map((item) => ({ id: String(item.id), dinnerId: id, url: signedUrls.get(String(item.storage_path)) ?? "", durationSeconds: Number(item.duration_seconds ?? 0), createdAt: String(item.created_at) })) }; });
  return { dinners: dinnerList, wines: wineList, wineExperiences: experienceList, space: { id: spaceId, name: spaceResult.data?.name ?? "Our table", tagline: spaceResult.data?.tagline ?? "", members: rows<Record<string, unknown>>(membersResult).map((member, index) => ({ id: String(member.user_id), name: index === 0 ? "You" : "Member", email: "", role: member.role as "owner" | "member" })) }, shareLinks: [] };
}

function safeName(name: string) { return name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(-80); }
function displayName(user: { email?: string; user_metadata?: Record<string, unknown> }) { const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name; return typeof metadataName === "string" && metadataName.trim() ? metadataName : user.email?.split("@")[0] || "You"; }
function fileToDataUrl(file: File) { return blobToDataUrl(file); }
function blobToDataUrl(blob: Blob): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); }); }
