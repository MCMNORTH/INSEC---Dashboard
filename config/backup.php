<?php

return [
    // Archives remain encrypted even when stored in the existing document bucket.
    'disk' => env('BACKUP_DISK', env('FILESYSTEM_DRIVER', 'local')),
    'key' => env('BACKUP_KEY', env('APP_KEY')),
    'pg_dump' => env('PG_DUMP_BINARY', 'pg_dump'),
    'timeout' => 300,
];
