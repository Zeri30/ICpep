<?php

namespace App\Http\Controllers;

use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\RegistrationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    /**
     * Whether the form is accepting submissions, and the officer-selected reason
     * if it isn't. Public: the landing page reads this to decide between showing
     * the form and showing the closed notice.
     */
    public function status(): JsonResponse
    {
        $setting = RegistrationSetting::instance();

        return response()->json([
            'isOpen' => $setting->is_open,
            'reason' => $setting->is_open ? null : $setting->closed_reason,
        ]);
    }

    /**
     * Store a membership application submitted from the website.
     * Files are uploaded to the default filesystem disk (Supabase Storage in
     * production), and the record is saved to the database.
     */
    public function store(Request $request): JsonResponse
    {
        // The form is hidden while registration is closed, so reaching here means
        // a stale page or a direct post — refuse rather than file the applicant
        // under a list nobody is watching. 403 carries the reason so a page left
        // open since before the close can explain itself.
        $setting = RegistrationSetting::instance();

        if (! $setting->is_open) {
            return response()->json([
                'message' => 'Membership registration is currently closed.',
                'reason' => $setting->closed_reason,
                'registrationClosed' => true,
            ], 403);
        }

        // New applicants always join whichever list is current — never the most
        // recently created one.
        //
        // With no current list there is nowhere to file them: the record would
        // belong to no semester and so appear in no admin module. Refusing is
        // the safer failure, and reads to the applicant like any other closure.
        $term = MembershipTerm::current();

        if (! $term) {
            return response()->json([
                'message' => 'Membership registration is currently closed.',
                'reason' => 'No membership list is currently active.',
                'registrationClosed' => true,
            ], 403);
        }

        $validated = $request->validate([
            'surname'        => ['required', 'string', 'max:100'],
            'givenName'      => ['required', 'string', 'max:100'],
            'middleInitial'  => ['nullable', 'string', 'max:1'],
            'yearLevel'      => ['required', 'string', 'max:50'],
            'section'        => ['required', 'string', 'max:50'],
            'birthday'       => ['required', 'date'],
            'address'        => ['required', 'string', 'max:500'],
            'email'          => ['required', 'email', 'max:150'],
            'phone'          => ['required', 'string', 'max:30'],
            'signature'      => ['required', 'file', 'mimes:jpeg,jpg,png,webp,pdf', 'max:5120'],
            'picture'        => ['required', 'file', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ]);

        // Upload files to the configured disk. store() generates a random,
        // collision-free name and returns the path within the bucket.
        $signaturePath = $request->file('signature')->store('signatures');
        $picturePath = $request->file('picture')->store('pictures');

        $application = Application::create([
            'membership_term_id' => $term->id,
            'surname'         => $validated['surname'],
            'given_name'      => $validated['givenName'],
            'middle_initial'  => $validated['middleInitial'] ?? null,
            'year_level'      => $validated['yearLevel'],
            'section'         => $validated['section'],
            'birthday'        => $validated['birthday'],
            'address'         => $validated['address'],
            'email'           => $validated['email'],
            'phone'           => $validated['phone'],
            'signature_path'  => $signaturePath,
            'picture_path'    => $picturePath,
        ]);

        return response()->json([
            'message' => 'Membership registered',
            'id'      => $application->id,
        ], 201);
    }
}
