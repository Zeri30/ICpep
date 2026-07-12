<?php

namespace App\Http\Controllers;

use App\Models\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    /**
     * Store a membership application submitted from the website.
     * Files are uploaded to the default filesystem disk (Supabase Storage in
     * production), and the record is saved to the database.
     */
    public function store(Request $request): JsonResponse
    {
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
            'status'          => 'pending',
        ]);

        return response()->json([
            'message' => 'Application received',
            'id'      => $application->id,
        ], 201);
    }
}
