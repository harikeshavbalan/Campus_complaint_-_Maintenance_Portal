"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function NewComplaint() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Electrical");
  const [priority, setPriority] = useState("medium");
  const [location, setLocation] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  function pickFile(selectedFile: File | null) {
    if (!selectedFile) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Please upload a JPG, PNG or WEBP image.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5 MB.");
      return;
    }

    setError("");
    setFile(selectedFile);

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPreview(URL.createObjectURL(selectedFile));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    // Get logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    // Create complaint
    const { data: complaint, error: complaintError } = await supabase
      .from("complaints")
      .insert({
        title,
        description,
        category,
        priority,
        location: location || null,

        // IMPORTANT:
        // Your actual database uses complainant_id
        complainant_id: user.id,
      })
      .select()
      .single();

    if (complaintError || !complaint) {
      console.error("Complaint creation error:", complaintError);

      setError(
        complaintError?.message ||
          "Could not create the complaint."
      );

      setLoading(false);
      return;
    }

    // Upload image if selected
    if (file) {
      const safeFileName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      );

      const filePath = `${user.id}/${complaint.id}/${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("complaint-attachments")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Image upload error:", uploadError);

        setError(
          `Complaint created, but image upload failed: ${uploadError.message}`
        );

        setLoading(false);
        return;
      }

      // Save attachment information
      const { error: attachmentError } = await supabase
        .from("attachments")
        .insert({
          complaint_id: complaint.id,
          file_name: file.name,
          file_type: file.type,
          file_path: filePath,
          uploaded_by: user.id,
        });

      if (attachmentError) {
        console.error(
          "Attachment record error:",
          attachmentError
        );

        setError(
          `Complaint created, but attachment record failed: ${attachmentError.message}`
        );

        setLoading(false);
        return;
      }
    }

    // Open complaint details
    router.replace(`/complaints/${complaint.id}`);
  }

  return (
    <main className="container">
      <div className="form card">
        <span className="eyebrow">NEW COMPLAINT</span>

        <h1>Report a campus issue</h1>

        <p className="muted">
          Give enough detail for the Admin and Technician to
          act quickly.
        </p>

        {error && (
          <div className="alert error">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          {/* TITLE */}
          <div className="field">
            <label className="label">
              Title
            </label>

            <input
              className="input"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="e.g. Water leakage in Block A"
              required
            />
          </div>

          {/* CATEGORY + PRIORITY */}
          <div className="grid grid-2">
            <div className="field">
              <label className="label">
                Category
              </label>

              <select
                className="select"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value)
                }
              >
                <option>Electrical</option>
                <option>Plumbing</option>
                <option>Furniture</option>
                <option>Cleaning</option>
                <option>Network</option>
                <option>Building</option>
                <option>Other</option>
              </select>
            </div>

            <div className="field">
              <label className="label">
                Priority
              </label>

              <select
                className="select"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value)
                }
              >
                <option value="low">
                  Low
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="high">
                  High
                </option>

                <option value="critical">
                  Critical
                </option>
              </select>
            </div>
          </div>

          {/* LOCATION */}
          <div className="field">
            <label className="label">
              Location
            </label>

            <input
              className="input"
              value={location}
              onChange={(e) =>
                setLocation(e.target.value)
              }
              placeholder="Block / floor / room"
            />
          </div>

          {/* DESCRIPTION */}
          <div className="field">
            <label className="label">
              Description
            </label>

            <textarea
              className="textarea"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Describe what happened..."
              required
            />
          </div>

          {/* IMAGE */}
          <div className="field">
            <label className="label">
              Issue image
            </label>

            <p className="muted small">
              Optional • JPG, PNG or WEBP • Maximum 5 MB
            </p>

            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) =>
                pickFile(
                  e.target.files?.[0] || null
                )
              }
            />

            {preview && (
              <div className="image-preview-box">
                <img
                  className="preview"
                  src={preview}
                  alt="Selected issue"
                />

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (preview) {
                      URL.revokeObjectURL(preview);
                    }

                    setPreview("");
                    setFile(null);
                  }}
                >
                  Remove image
                </button>
              </div>
            )}
          </div>

          {/* SUBMIT */}
          <div className="actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading
                ? "Submitting..."
                : "Submit complaint"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}