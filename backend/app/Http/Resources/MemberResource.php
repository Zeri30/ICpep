<?php

namespace App\Http\Resources;

use App\Models\Application;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * A member (application) as the React admin consumes it. Mirrors the columns and
 * derived values the Filament Members List showed — full name, class code, paid
 * status — plus short-lived signed URLs for the private photo/signature.
 *
 * @mixin Application
 */
class MemberResource extends JsonResource
{
    /** Signed URLs are only worth the cost on a single record, not every list row. */
    public bool $withFiles = false;

    public function withFiles(bool $value = true): static
    {
        $this->withFiles = $value;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'surname' => $this->surname,
            'givenName' => $this->given_name,
            'middleInitial' => $this->middle_initial,
            'fullName' => $this->full_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'yearLevel' => $this->year_level,
            'section' => $this->section,
            'classCode' => $this->class_code,
            'birthday' => optional($this->birthday)->toDateString(),
            'address' => $this->address,
            'isPaid' => $this->is_paid,
            'paidAt' => optional($this->paid_at)->toIso8601String(),
            'createdAt' => optional($this->created_at)->toIso8601String(),
            'deletedAt' => optional($this->deleted_at)->toIso8601String(),
            // Cheap on a list (a local S3 signature, no network call), so the
            // photo thumbnail is always available.
            'photoUrl' => $this->signedUrl($this->picture_path),
            $this->mergeWhen($this->withFiles, fn (): array => [
                'pictureUrl' => $this->signedUrl($this->picture_path),
                'signatureUrl' => $this->signedUrl($this->signature_path),
            ]),
        ];
    }

    /** A 10-minute signed URL into the private Supabase bucket, or null. */
    private function signedUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        try {
            return Storage::disk('supabase')->temporaryUrl($path, now()->addMinutes(10));
        } catch (\Throwable $e) {
            return null;
        }
    }
}
