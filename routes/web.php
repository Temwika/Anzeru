<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect('/app'));

Route::middleware(['auth'])->group(function () {
    Route::get('/receipts/{id}', [App\Http\Controllers\ReceiptController::class, 'show'])
        ->name('receipts.show');
});
