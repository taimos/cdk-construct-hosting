import { SinglePageAppHosting } from '../lib/index';
import { App, Stack } from '@aws-cdk/core';
import { expect as expectCDK, haveResourceLike } from '@aws-cdk/assert';

test('should be valid', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'testing-stack');
    new SinglePageAppHosting(stack, 'SPA', {
        domainName: 'example.net',
        certArn: 'arn:aws:acm:us-east-1:123456789012:certificate/foobar',
        zoneId: '1234567890',
    });

    expectCDK(stack).to(haveResourceLike('AWS::CloudFront::Distribution', {
        "DistributionConfig": {
            "Aliases": [
                "example.net"
            ],
            "Comment": "example.net Website",
            "CustomErrorResponses": [
                {
                    "ErrorCode": 403,
                    "ResponseCode": 200,
                    "ResponsePagePath": "/index.html"
                },
                {
                    "ErrorCode": 404,
                    "ResponseCode": 200,
                    "ResponsePagePath": "/index.html"
                }
            ],
            "DefaultRootObject": "index.html",
            "ViewerCertificate": {
                "AcmCertificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/foobar",
                "SslSupportMethod": "sni-only"
            }
        }
    }));
    // console.log(JSON.stringify(SynthUtils.toCloudFormation(stack, {}), null, 2));
});

test('should auto generate certificates', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'testing-stack');
    new SinglePageAppHosting(stack, 'SPA', {
        domainName: 'example.net',
        zoneId: '1234567890',
    });

    expectCDK(stack).to(haveResourceLike('AWS::CloudFormation::CustomResource', {
        "DomainName": "example.net",
        "HostedZoneId": "1234567890",
        "Region": "us-east-1"
    }));
    // console.log(JSON.stringify(SynthUtils.toCloudFormation(stack, {}), null, 2));
});
