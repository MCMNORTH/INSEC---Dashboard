<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_liveness_endpoint_is_public(): void
    { $this->getJson(route('health.live'))->assertOk()->assertJson(['status'=>'ok','application'=>'INSEC Dashboard']); }

    public function test_readiness_endpoint_checks_critical_dependencies_without_exposing_secrets(): void
    {
        config(['app.key'=>'base64:'.base64_encode(str_repeat('a',32)),'app.debug'=>false]);
        $response=$this->getJson(route('health.ready'))->assertOk()->assertJsonPath('checks.database','ok')->assertJsonPath('checks.storage','ok');
        $response->assertJsonMissing(['message'=>'base64:test-key']);
    }

    public function test_readiness_fails_when_production_debug_is_enabled(): void
    {
        app()->detectEnvironment(fn()=>'production');config(['app.key'=>'base64:'.base64_encode(str_repeat('a',32)),'app.debug'=>true]);
        $this->getJson(route('health.ready'))->assertStatus(503)->assertJsonPath('checks.debug','failed');
    }
}
