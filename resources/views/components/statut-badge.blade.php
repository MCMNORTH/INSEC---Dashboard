@props(['statut'])
@php
    $styles = [
        'Actif' => 'bg-green-100 text-green-700',
        'Suspendu' => 'bg-amber-100 text-amber-700',
        'Diplômé' => 'bg-blue-100 text-blue-700',
        'Abandon' => 'bg-red-100 text-red-700',
    ];
    $style = $styles[$statut] ?? 'bg-gray-100 text-gray-700';
@endphp
<span {{ $attributes->merge(['class' => "inline-block px-3 py-1 text-xs font-medium rounded-full $style"]) }}>
    {{ $statut }}
</span>