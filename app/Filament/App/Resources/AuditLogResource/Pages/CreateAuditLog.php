<?php

namespace App\Filament\App\Resources\AuditLogResource\Pages;

use App\Filament\App\Resources\AuditLogResource;
use Filament\Actions;
use Filament\Resources\Pages\CreateRecord;

class CreateAuditLog extends CreateRecord
{
    protected static string $resource = AuditLogResource::class;
}
